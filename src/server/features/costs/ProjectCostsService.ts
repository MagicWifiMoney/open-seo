import { z } from "zod";
import {
  CostLedgerRepository,
  type CostLedgerRow,
} from "./CostLedgerRepository";
import { CostRunReads } from "./costRunReads";
import { aiCostForAnswers } from "@/server/features/ai-visibility/services/aiVisibilityCost";
import { LIGHTHOUSE_LIVE_USD } from "@/server/lib/dataforseo/pricing";
import type { AiEngine } from "@/shared/ai-visibility";
import {
  costPerSerpAtDepth,
  serpKeywordCostMultiplier,
} from "@/shared/rank-tracking";
import type {
  ProjectCostsResponse,
  ProjectCostsRun,
} from "@/types/schemas/costs";

const LOOKUP_LIMIT = 500;
const OPEN_STATUSES = new Set(["pending", "queued", "running"]);

const roundUsd = (value: number) => Math.round(value * 1e6) / 1e6;
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

function addTo(record: Record<string, number>, key: string, usd: number) {
  record[key] = roundUsd((record[key] ?? 0) + usd);
}

const FALLBACK_HISTORY_DAYS = 365;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Without `from`, the window opens at the project's earliest ledger row or run. */
async function resolveWindow(projectId: string, from?: string, to?: string) {
  const end = to ?? isoDay(Date.now());
  if (from) return { from, to: end };
  const [ledgerFirst, runFirst] = await Promise.all([
    CostLedgerRepository.earliestAt(projectId),
    CostRunReads.earliestRunDay(projectId),
  ]);
  const candidates = [ledgerFirst?.slice(0, 10), runFirst].filter(
    (day): day is string => !!day,
  );
  const start = candidates.length
    ? candidates.reduce((a, b) => (a < b ? a : b))
    : isoDay(Date.parse(`${end}T00:00:00Z`) - FALLBACK_HISTORY_DAYS * 864e5);
  return { from: start, to: end };
}

function costFor(
  runId: string,
  status: string,
  sums: Map<string, { costUsd: number; rows: number }>,
  estimateUsd: () => number,
): Pick<ProjectCostsRun, "costUsd" | "costStatus"> {
  const sum = sums.get(runId);
  if (!sum || sum.rows === 0)
    return { costUsd: roundUsd(estimateUsd()), costStatus: "estimated" };
  return {
    costUsd: roundUsd(sum.costUsd),
    costStatus: OPEN_STATUSES.has(status) ? "partial" : "actual",
  };
}

type RunBase = Omit<ProjectCostsRun, "costUsd" | "costStatus">;

async function rankRuns(projectId: string, from: string, to: string) {
  const runs = await CostRunReads.listRankRuns(projectId, from, to);
  const sums = await CostLedgerRepository.sumByRun(runs.map((r) => r.id));
  const unpriced = runs.filter((r) => !sums.get(r.id)?.rows).map((r) => r.id);
  const keywords = await CostRunReads.listSnapshotKeywords(unpriced);
  return runs.map((run): ProjectCostsRun => {
    const deviceCount = run.devices === "both" ? 2 : 1;
    const base: RunBase = {
      runId: run.id,
      runKind: "rank_check_run",
      source: "rank_check",
      label: run.isSubsetRun ? "Rank check (selected keywords)" : "Rank check",
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      requested: `${plural(run.keywordsTotal, "keyword")} × ${plural(deviceCount, "device")}, top ${run.serpDepth}`,
      got: `${run.snapshots} checked, ${run.found} found in top ${run.serpDepth}`,
    };
    // Self-host cost is the raw provider price, always the live endpoint (the
    // run does not record its trigger, so this is the upper bound).
    const perSerp = costPerSerpAtDepth(run.serpDepth, "live");
    const estimate = () => {
      const checked = keywords.get(run.id);
      if (checked?.length)
        return checked.reduce(
          (sum, keyword) => sum + serpKeywordCostMultiplier(keyword) * perSerp,
          0,
        );
      return run.keywordsTotal * deviceCount * perSerp;
    };
    return { ...base, ...costFor(run.id, run.status, sums, estimate) };
  });
}

async function aiRunRows(projectId: string, from: string, to: string) {
  const runs = await CostRunReads.listAiRuns(projectId, from, to);
  const sums = await CostLedgerRepository.sumByRun(runs.map((r) => r.id));
  return runs.map((run): ProjectCostsRun => {
    const base: RunBase = {
      runId: run.id,
      runKind: "ai_run",
      source: "ai_visibility",
      label: "AI visibility check",
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      requested: `${plural(run.answers, "answer")} (${plural(run.prompts, "prompt")} × ${plural(run.engines.length, "engine")})`,
      got: `${plural(run.completed, "answer")}, ${plural(run.mentions, "brand mention")}`,
    };
    const estimate = () =>
      // Engines are not stored per answer here, so price each answer at the
      // run's engines in turn; this is a rough estimate by design.
      aiCostForAnswers(
        Array.from(
          { length: run.answers },
          (_, i) =>
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- engines come from the ai_observations enum column
            (run.engines[i % Math.max(run.engines.length, 1)] ??
              "chatgpt") as AiEngine,
        ),
        false,
        "queued",
      ).providerCostUsd;
    return { ...base, ...costFor(run.id, run.status, sums, estimate) };
  });
}

async function auditRows(projectId: string, from: string, to: string) {
  const audits = await CostRunReads.listAudits(projectId, from, to);
  const sums = await CostLedgerRepository.sumByRun(audits.map((a) => a.id));
  return audits.map((audit): ProjectCostsRun => {
    const config = parseConfig(audit.config);
    const base: RunBase = {
      runId: audit.id,
      runKind: "audit",
      source: "site_audit",
      label: "Site audit",
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      status: audit.status,
      requested: `${config.maxPages ? `up to ${plural(config.maxPages, "page")}` : "Pages"}, Lighthouse ${config.lighthouseStrategy === "none" ? "off" : "on"}`,
      got: `${plural(audit.pagesCrawled, "page")}, ${plural(audit.issues, "issue")}`,
    };
    return {
      ...base,
      ...costFor(
        audit.id,
        audit.status,
        sums,
        () => audit.lighthouseResults * LIGHTHOUSE_LIVE_USD,
      ),
    };
  });
}

const auditConfigSchema = z.object({
  maxPages: z.number().optional(),
  lighthouseStrategy: z.string().optional(),
});

function parseConfig(raw: string) {
  try {
    const parsed = auditConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function summarize(
  totalsRows: Awaited<ReturnType<typeof CostLedgerRepository.totalsByProject>>,
  lookupRows: CostLedgerRow[],
) {
  const totals: ProjectCostsResponse["totals"] = {
    usd: 0,
    byProvider: {},
    bySource: {},
  };
  for (const { provider, usd } of totalsRows.byProvider) {
    totals.usd += usd;
    addTo(totals.byProvider, provider, usd);
  }
  for (const { source, usd } of totalsRows.bySource)
    addTo(totals.bySource, source, usd);
  totals.usd = roundUsd(totals.usd);
  const lookups = lookupRows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt,
    source: row.source,
    operation: row.operation,
    requestSummary: row.requestSummary,
    resultCount: row.resultCount,
    costUsd: row.costUsd,
    status: row.status,
  }));
  return { totals, lookups };
}

export async function getProjectCosts(input: {
  projectId: string;
  from?: string;
  to?: string;
}): Promise<Omit<ProjectCostsResponse, "balanceUsd">> {
  const window = await resolveWindow(input.projectId, input.from, input.to);
  const [totalsRows, lookupRows, dayRows, ledgerSince, rank, ai, audit] =
    await Promise.all([
      CostLedgerRepository.totalsByProject(
        input.projectId,
        window.from,
        window.to,
      ),
      CostLedgerRepository.listLookups(input.projectId, {
        ...window,
        limit: LOOKUP_LIMIT,
      }),
      CostLedgerRepository.sumByDay(input.projectId, window.from, window.to),
      CostLedgerRepository.earliestAt(input.projectId),
      rankRuns(input.projectId, window.from, window.to),
      aiRunRows(input.projectId, window.from, window.to),
      auditRows(input.projectId, window.from, window.to),
    ]);

  const days = new Map<string, ProjectCostsResponse["days"][number]>();
  for (const { date, source, usd } of dayRows) {
    const day = days.get(date) ?? { date, usd: 0, bySource: {} };
    day.usd = roundUsd(day.usd + usd);
    addTo(day.bySource, source, usd);
    days.set(date, day);
  }

  const { totals, lookups } = summarize(totalsRows, lookupRows);
  // oxlint-disable-next-line unicorn/no-array-sort -- fresh array; tsconfig lib lacks toSorted
  const runs = [...rank, ...ai, ...audit].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  return {
    window,
    totals,
    // oxlint-disable-next-line unicorn/no-array-sort -- fresh array; tsconfig lib lacks toSorted
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    runs,
    lookups,
    ledgerSince: ledgerSince ? ledgerSince.slice(0, 10) : null,
  };
}
