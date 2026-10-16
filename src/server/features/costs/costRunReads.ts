import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiMatches,
  aiObservations,
  aiRuns,
  auditIssues,
  auditLighthouseResults,
  audits,
  rankCheckRuns,
  rankSnapshots,
  rankTrackingConfigs,
} from "@/db/schema";

// Read-only run summaries for the Costs tab. `from`/`to` are inclusive
// YYYY-MM-DD dates compared against each run's start time.

const CHUNK = 80;
const dayStart = (date: string) => `${date}T00:00:00.000Z`;
const dayEnd = (date: string) => `${date}T23:59:59.999Z`;

// rank_check_runs and audits default started_at to SQLite's
// "YYYY-MM-DD HH:MM:SS", which sorts below the same day's ISO form, so those
// two compare on the date prefix.

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK)
    out.push(items.slice(i, i + CHUNK));
  return out;
}

export type RankRunSummary = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  isSubsetRun: boolean;
  keywordsTotal: number;
  keywordsChecked: number;
  devices: "both" | "desktop" | "mobile";
  serpDepth: number;
  snapshots: number;
  found: number;
};

async function listRankRuns(
  projectId: string,
  from: string,
  to: string,
): Promise<RankRunSummary[]> {
  const runs = await db
    .select({
      id: rankCheckRuns.id,
      status: rankCheckRuns.status,
      startedAt: rankCheckRuns.startedAt,
      completedAt: rankCheckRuns.completedAt,
      isSubsetRun: rankCheckRuns.isSubsetRun,
      keywordsTotal: rankCheckRuns.keywordsTotal,
      keywordsChecked: rankCheckRuns.keywordsChecked,
      devices: rankTrackingConfigs.devices,
      serpDepth: rankTrackingConfigs.serpDepth,
    })
    .from(rankCheckRuns)
    .innerJoin(
      rankTrackingConfigs,
      eq(rankTrackingConfigs.id, rankCheckRuns.configId),
    )
    .where(
      and(
        eq(rankCheckRuns.projectId, projectId),
        gte(sql`substr(${rankCheckRuns.startedAt}, 1, 10)`, from),
        lte(sql`substr(${rankCheckRuns.startedAt}, 1, 10)`, to),
      ),
    );
  const counts = new Map<string, { snapshots: number; found: number }>();
  for (const ids of chunks(runs.map((run) => run.id))) {
    const rows = await db
      .select({
        runId: rankSnapshots.runId,
        snapshots: sql<number>`count(*)`,
        found: sql<number>`sum(case when ${rankSnapshots.position} is not null then 1 else 0 end)`,
      })
      .from(rankSnapshots)
      .where(inArray(rankSnapshots.runId, ids))
      .groupBy(rankSnapshots.runId);
    for (const row of rows)
      counts.set(row.runId, {
        snapshots: Number(row.snapshots),
        found: Number(row.found ?? 0),
      });
  }
  return runs.map((run) => ({
    ...run,
    snapshots: counts.get(run.id)?.snapshots ?? 0,
    found: counts.get(run.id)?.found ?? 0,
  }));
}

/** Keyword text of every checked snapshot, for pricing runs with no ledger. */
async function listSnapshotKeywords(runIds: string[]) {
  const byRun = new Map<string, string[]>();
  for (const ids of chunks(runIds)) {
    const rows = await db
      .select({ runId: rankSnapshots.runId, keyword: rankSnapshots.keyword })
      .from(rankSnapshots)
      .where(inArray(rankSnapshots.runId, ids));
    for (const row of rows)
      byRun.set(row.runId, [...(byRun.get(row.runId) ?? []), row.keyword]);
  }
  return byRun;
}

export type AiRunSummary = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  answers: number;
  completed: number;
  prompts: number;
  engines: string[];
  mentions: number;
};

async function listAiRuns(
  projectId: string,
  from: string,
  to: string,
): Promise<AiRunSummary[]> {
  const runs = await db
    .select({
      id: aiRuns.id,
      status: aiRuns.status,
      startedAt: aiRuns.createdAt,
      completedAt: aiRuns.completedAt,
    })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.projectId, projectId),
        gte(aiRuns.createdAt, dayStart(from)),
        lte(aiRuns.createdAt, dayEnd(to)),
      ),
    );
  const observed = new Map<
    string,
    {
      answers: number;
      completed: number;
      prompts: Set<string>;
      engines: Set<string>;
    }
  >();
  const mentions = new Map<string, number>();
  for (const ids of chunks(runs.map((run) => run.id))) {
    const rows = await db
      .select({
        runId: aiObservations.runId,
        promptId: aiObservations.promptId,
        engine: aiObservations.engine,
        status: aiObservations.status,
      })
      .from(aiObservations)
      .where(inArray(aiObservations.runId, ids));
    for (const row of rows) {
      const entry = observed.get(row.runId) ?? {
        answers: 0,
        completed: 0,
        prompts: new Set<string>(),
        engines: new Set<string>(),
      };
      entry.answers += 1;
      if (row.status === "completed") entry.completed += 1;
      entry.prompts.add(row.promptId);
      entry.engines.add(row.engine);
      observed.set(row.runId, entry);
    }
    const matched = await db
      .select({
        runId: aiObservations.runId,
        mentions: sql<number>`count(*)`,
      })
      .from(aiMatches)
      .innerJoin(aiObservations, eq(aiObservations.id, aiMatches.observationId))
      .where(
        and(
          inArray(aiObservations.runId, ids),
          eq(aiMatches.own, true),
          eq(aiMatches.mentioned, true),
        ),
      )
      .groupBy(aiObservations.runId);
    for (const row of matched) mentions.set(row.runId, Number(row.mentions));
  }
  return runs.map((run) => {
    const entry = observed.get(run.id);
    return {
      ...run,
      answers: entry?.answers ?? 0,
      completed: entry?.completed ?? 0,
      prompts: entry?.prompts.size ?? 0,
      engines: [...(entry?.engines ?? [])],
      mentions: mentions.get(run.id) ?? 0,
    };
  });
}

export type AuditRunSummary = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  config: string;
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseResults: number;
  issues: number;
};

async function listAudits(
  projectId: string,
  from: string,
  to: string,
): Promise<AuditRunSummary[]> {
  const rows = await db
    .select({
      id: audits.id,
      status: audits.status,
      startedAt: audits.startedAt,
      completedAt: audits.completedAt,
      config: audits.config,
      pagesCrawled: audits.pagesCrawled,
      pagesTotal: audits.pagesTotal,
    })
    .from(audits)
    .where(
      and(
        eq(audits.projectId, projectId),
        gte(sql`substr(${audits.startedAt}, 1, 10)`, from),
        lte(sql`substr(${audits.startedAt}, 1, 10)`, to),
      ),
    );
  const lighthouse = new Map<string, number>();
  const issues = new Map<string, number>();
  for (const ids of chunks(rows.map((row) => row.id))) {
    const lh = await db
      .select({
        auditId: auditLighthouseResults.auditId,
        n: sql<number>`count(*)`,
      })
      .from(auditLighthouseResults)
      .where(inArray(auditLighthouseResults.auditId, ids))
      .groupBy(auditLighthouseResults.auditId);
    for (const row of lh) lighthouse.set(row.auditId, Number(row.n));
    const found = await db
      .select({ auditId: auditIssues.auditId, n: sql<number>`count(*)` })
      .from(auditIssues)
      .where(inArray(auditIssues.auditId, ids))
      .groupBy(auditIssues.auditId);
    for (const row of found) issues.set(row.auditId, Number(row.n));
  }
  return rows.map((row) => ({
    ...row,
    lighthouseResults: lighthouse.get(row.id) ?? 0,
    issues: issues.get(row.id) ?? 0,
  }));
}

export const CostRunReads = {
  listRankRuns,
  listSnapshotKeywords,
  listAiRuns,
  listAudits,
};
