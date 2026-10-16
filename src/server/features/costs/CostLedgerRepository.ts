import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { costLedger } from "@/db/schema";
import type {
  CostProvider,
  CostRunKind,
  CostSource,
  CostStatus,
} from "@/types/schemas/costs";

export type CostLedgerEntry = {
  projectId: string;
  organizationId: string;
  userId?: string | null;
  /** ISO timestamp; defaults to now. */
  occurredAt?: string;
  source: CostSource;
  runId?: string | null;
  runKind?: CostRunKind | null;
  provider: CostProvider;
  creditFeature?: string | null;
  apiPath?: string | null;
  operation: string;
  requestSummary?: string | null;
  resultCount?: number | null;
  costUsd: number;
  status: CostStatus;
};

export type CostLedgerRow = typeof costLedger.$inferSelect;

export type RunCostSum = { costUsd: number; rows: number };
export type DayCostSum = { date: string; source: string; usd: number };

// Columns bound per row are 15, so 5 rows stay under D1's 90-parameter budget.
const ROWS_PER_STATEMENT = 5;
const RUN_ID_CHUNK = 80;
const SUMMARY_MAX = 500;

const dayStart = (date: string) => `${date}T00:00:00.000Z`;
const dayEnd = (date: string) => `${date}T23:59:59.999Z`;

function clip(summary: string | null | undefined) {
  if (summary == null) return null;
  return summary.length > SUMMARY_MAX ? summary.slice(0, SUMMARY_MAX) : summary;
}

function toRow(entry: CostLedgerEntry) {
  return {
    projectId: entry.projectId,
    organizationId: entry.organizationId,
    userId: entry.userId ?? null,
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
    source: entry.source,
    runId: entry.runId ?? null,
    runKind: entry.runKind ?? null,
    provider: entry.provider,
    creditFeature: entry.creditFeature ?? null,
    apiPath: entry.apiPath ?? null,
    operation: entry.operation,
    requestSummary: clip(entry.requestSummary),
    resultCount: entry.resultCount ?? null,
    costUsd: entry.costUsd,
    status: entry.status,
  };
}

/**
 * Never throws: a ledger write must not fail the paid call it records. The
 * promise is returned so callers can hand it to waitUntil.
 */
async function recordMany(entries: CostLedgerEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const rows = entries.map(toRow);
    const chunks: (typeof rows)[] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT)
      chunks.push(rows.slice(i, i + ROWS_PER_STATEMENT));
    await runBatch((tx) =>
      chunks.map((chunk) => tx.insert(costLedger).values(chunk)),
    );
  } catch (error) {
    console.error("[cost-ledger] write failed", {
      rows: entries.length,
      projectId: entries[0]?.projectId,
      error,
    });
  }
}

const record = (entry: CostLedgerEntry) => recordMany([entry]);

/** `from`/`to` are inclusive YYYY-MM-DD dates (UTC). */
async function listByProject(
  projectId: string,
  { from, to, limit }: { from: string; to: string; limit?: number },
): Promise<CostLedgerRow[]> {
  const query = db
    .select()
    .from(costLedger)
    .where(
      and(
        eq(costLedger.projectId, projectId),
        gte(costLedger.occurredAt, dayStart(from)),
        lte(costLedger.occurredAt, dayEnd(to)),
      ),
    )
    .orderBy(desc(costLedger.occurredAt), desc(costLedger.id));
  return limit ? query.limit(limit) : query;
}

export type LedgerTotals = {
  byProvider: { provider: string; usd: number }[];
  bySource: { source: string; usd: number }[];
};

/** Window totals computed in SQL so no row is loaded. */
async function totalsByProject(
  projectId: string,
  from: string,
  to: string,
): Promise<LedgerTotals> {
  const where = and(
    eq(costLedger.projectId, projectId),
    gte(costLedger.occurredAt, dayStart(from)),
    lte(costLedger.occurredAt, dayEnd(to)),
  );
  const usd = sql<number>`sum(${costLedger.costUsd})`;
  const [byProvider, bySource] = await Promise.all([
    db
      .select({ provider: costLedger.provider, usd })
      .from(costLedger)
      .where(where)
      .groupBy(costLedger.provider),
    db
      .select({ source: costLedger.source, usd })
      .from(costLedger)
      .where(where)
      .groupBy(costLedger.source),
  ]);
  return {
    byProvider: byProvider.map((r) => ({
      provider: r.provider,
      usd: Number(r.usd),
    })),
    bySource: bySource.map((r) => ({ source: r.source, usd: Number(r.usd) })),
  };
}

/** Newest rows not tied to a run (individual lookups), capped at `limit`. */
async function listLookups(
  projectId: string,
  { from, to, limit }: { from: string; to: string; limit: number },
): Promise<CostLedgerRow[]> {
  return db
    .select()
    .from(costLedger)
    .where(
      and(
        eq(costLedger.projectId, projectId),
        isNull(costLedger.runId),
        gte(costLedger.occurredAt, dayStart(from)),
        lte(costLedger.occurredAt, dayEnd(to)),
      ),
    )
    .orderBy(desc(costLedger.occurredAt), desc(costLedger.id))
    .limit(limit);
}

async function sumByRun(runIds: string[]): Promise<Map<string, RunCostSum>> {
  const sums = new Map<string, RunCostSum>();
  for (let i = 0; i < runIds.length; i += RUN_ID_CHUNK) {
    const chunk = runIds.slice(i, i + RUN_ID_CHUNK);
    const rows = await db
      .select({
        runId: costLedger.runId,
        costUsd: sql<number>`sum(${costLedger.costUsd})`,
        rows: sql<number>`count(*)`,
      })
      .from(costLedger)
      .where(inArray(costLedger.runId, chunk))
      .groupBy(costLedger.runId);
    for (const row of rows)
      if (row.runId)
        sums.set(row.runId, {
          costUsd: Number(row.costUsd),
          rows: Number(row.rows),
        });
  }
  return sums;
}

/** One entry per (day, source); `from`/`to` are inclusive YYYY-MM-DD dates. */
async function sumByDay(
  projectId: string,
  from: string,
  to: string,
): Promise<DayCostSum[]> {
  const day = sql<string>`substr(${costLedger.occurredAt}, 1, 10)`;
  const rows = await db
    .select({
      date: day,
      source: costLedger.source,
      usd: sql<number>`sum(${costLedger.costUsd})`,
    })
    .from(costLedger)
    .where(
      and(
        eq(costLedger.projectId, projectId),
        gte(costLedger.occurredAt, dayStart(from)),
        lte(costLedger.occurredAt, dayEnd(to)),
      ),
    )
    .groupBy(day, costLedger.source)
    .orderBy(asc(day));
  return rows.map((row) => ({
    date: row.date,
    source: row.source,
    usd: Number(row.usd),
  }));
}

/** Earliest ledger timestamp for the project, or null when empty. */
async function earliestAt(projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ at: sql<string | null>`min(${costLedger.occurredAt})` })
    .from(costLedger)
    .where(eq(costLedger.projectId, projectId));
  return row?.at ?? null;
}

export const CostLedgerRepository = {
  record,
  recordMany,
  listByProject,
  totalsByProject,
  listLookups,
  sumByRun,
  sumByDay,
  earliestAt,
};
