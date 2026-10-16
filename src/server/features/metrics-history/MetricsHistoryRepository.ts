import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { metricsHistoryReads } from "./metricsHistoryReads";
import { runBatch } from "@/db/runBatch";
import {
  ga4Connections,
  ga4DailyChannel,
  ga4DailyKeyEvent,
  ga4DailyLandingPage,
  ga4DailyTotal,
  gscConnections,
  gscDailyPage,
  gscDailyQueryPage,
  gscDailySite,
  metricsIngestState,
} from "@/db/schema";

export type MetricsSource = "gsc" | "ga4";

type GscMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  finalized: boolean;
};
export type GscSiteRow = GscMetrics & { date: string; device: string };
export type GscPageRow = GscMetrics & { date: string; page: string };
export type GscQueryPageRow = GscMetrics & {
  date: string;
  query: string;
  page: string;
  device: string;
};
export type Ga4TotalRow = {
  date: string;
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  keyEvents: number;
};
export type Ga4ChannelRow = Ga4TotalRow & { channelGroup: string };
export type Ga4LandingPageRow = {
  date: string;
  channelGroup: string;
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
};
export type Ga4KeyEventRow = {
  date: string;
  channelGroup: string;
  eventName: string;
  keyEvents: number;
  totalUsers: number;
};

export type IngestStatePatch = {
  backfillCursorDate?: string | null;
  backfillDone?: boolean;
  lastSuccessAt?: string | null;
  lastError?: string | null;
};

// D1 rejects a statement with 100 or more bound parameters ("too many SQL
// variables", seen live on the miller-ingest stage 2026-10-16). Each inserted
// row binds one parameter per column, and the GSC conflict clause binds one
// more (fetchedAt), so size statements against a budget below the limit.
export const D1_PARAM_LIMIT = 100;
const D1_PARAM_BUDGET = 90;
// projectId, date, fetchedAt, then the row's own columns.
export const COMMON_PARAMS = 3;
// Bound by the conflict clause on top of the row values.
export const CONFLICT_PARAMS = 1;
// Rows per statement: GSC site 9 params -> 10, page 8 -> 11, query/page 10 -> 9,
// GA4 total 7 -> 12, channel 8 -> 11, landing page 8 -> 11, key event 7 -> 12.
export const rowsPerStatement = (ownColumns: number) =>
  Math.floor(D1_PARAM_BUDGET / (COMMON_PARAMS + ownColumns));

// Splits rows into param-safe statements and runs them in bounded batches.
async function insertChunked<T>(
  rows: T[],
  perStatement: number,
  build: (
    tx: Parameters<Parameters<typeof runBatch>[0]>[0],
    chunk: T[],
  ) => Promise<unknown>,
) {
  if (rows.length === 0) return;
  const statements: T[][] = [];
  for (let i = 0; i < rows.length; i += perStatement)
    statements.push(rows.slice(i, i + perStatement));
  // Keep each runBatch call bounded; statements within it stay atomic.
  const perBatch = 20;
  for (let i = 0; i < statements.length; i += perBatch) {
    const group = statements.slice(i, i + perBatch);
    await runBatch((tx) => group.map((chunk) => build(tx, chunk)));
  }
}

type GscTable =
  | typeof gscDailySite
  | typeof gscDailyPage
  | typeof gscDailyQueryPage;

// A refetch only replaces a row when it is at least as final as the stored one,
// so a non-finalized fetch never overwrites a finalized row. finalized itself
// is the OR of both (never downgraded).
function gscConflictSet(table: GscTable, fetchedAt: string) {
  const keep = <C>(excluded: string, existing: C) =>
    sql`CASE WHEN excluded.finalized >= ${table.finalized} THEN ${sql.raw(`excluded.${excluded}`)} ELSE ${existing} END`;
  return {
    clicks: keep("clicks", table.clicks),
    impressions: keep("impressions", table.impressions),
    ctr: keep("ctr", table.ctr),
    position: keep("position", table.position),
    fetchedAt: sql`CASE WHEN excluded.finalized >= ${table.finalized} THEN ${fetchedAt} ELSE ${table.fetchedAt} END`,
    finalized: sql`(excluded.finalized OR ${table.finalized})`,
  };
}

const now = () => new Date().toISOString();

async function listGscConnections() {
  return db.select().from(gscConnections);
}
async function listGa4Connections() {
  return db.select().from(ga4Connections);
}

async function upsertGscSite(projectId: string, rows: GscSiteRow[]) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(6), (tx, chunk) =>
    tx
      .insert(gscDailySite)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [
          gscDailySite.projectId,
          gscDailySite.date,
          gscDailySite.device,
        ],
        set: gscConflictSet(gscDailySite, fetchedAt),
      }),
  );
}

async function upsertGscPage(projectId: string, rows: GscPageRow[]) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(5), (tx, chunk) =>
    tx
      .insert(gscDailyPage)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [gscDailyPage.projectId, gscDailyPage.date, gscDailyPage.page],
        set: gscConflictSet(gscDailyPage, fetchedAt),
      }),
  );
}

async function upsertGscQueryPage(projectId: string, rows: GscQueryPageRow[]) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(7), (tx, chunk) =>
    tx
      .insert(gscDailyQueryPage)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [
          gscDailyQueryPage.projectId,
          gscDailyQueryPage.date,
          gscDailyQueryPage.query,
          gscDailyQueryPage.page,
          gscDailyQueryPage.device,
        ],
        set: gscConflictSet(gscDailyQueryPage, fetchedAt),
      }),
  );
}

async function upsertGa4Total(projectId: string, rows: Ga4TotalRow[]) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(4), (tx, chunk) =>
    tx
      .insert(ga4DailyTotal)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [ga4DailyTotal.projectId, ga4DailyTotal.date],
        set: {
          sessions: sql`excluded.sessions`,
          activeUsers: sql`excluded.active_users`,
          engagedSessions: sql`excluded.engaged_sessions`,
          keyEvents: sql`excluded.key_events`,
          fetchedAt,
        },
      }),
  );
}

async function upsertGa4Channel(projectId: string, rows: Ga4ChannelRow[]) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(5), (tx, chunk) =>
    tx
      .insert(ga4DailyChannel)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [
          ga4DailyChannel.projectId,
          ga4DailyChannel.date,
          ga4DailyChannel.channelGroup,
        ],
        set: {
          sessions: sql`excluded.sessions`,
          activeUsers: sql`excluded.active_users`,
          engagedSessions: sql`excluded.engaged_sessions`,
          keyEvents: sql`excluded.key_events`,
          fetchedAt,
        },
      }),
  );
}

async function upsertGa4LandingPage(
  projectId: string,
  rows: Ga4LandingPageRow[],
) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(5), (tx, chunk) =>
    tx
      .insert(ga4DailyLandingPage)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [
          ga4DailyLandingPage.projectId,
          ga4DailyLandingPage.date,
          ga4DailyLandingPage.channelGroup,
          ga4DailyLandingPage.landingPage,
        ],
        set: {
          sessions: sql`excluded.sessions`,
          engagedSessions: sql`excluded.engaged_sessions`,
          keyEvents: sql`excluded.key_events`,
          fetchedAt,
        },
      }),
  );
}

async function upsertGa4KeyEvent(projectId: string, rows: Ga4KeyEventRow[]) {
  const fetchedAt = now();
  await insertChunked(rows, rowsPerStatement(4), (tx, chunk) =>
    tx
      .insert(ga4DailyKeyEvent)
      .values(chunk.map((r) => ({ ...r, projectId, fetchedAt })))
      .onConflictDoUpdate({
        target: [
          ga4DailyKeyEvent.projectId,
          ga4DailyKeyEvent.date,
          ga4DailyKeyEvent.channelGroup,
          ga4DailyKeyEvent.eventName,
        ],
        set: {
          keyEvents: sql`excluded.key_events`,
          totalUsers: sql`excluded.total_users`,
          fetchedAt,
        },
      }),
  );
}

const stateKey = (projectId: string, source: MetricsSource) =>
  and(
    eq(metricsIngestState.projectId, projectId),
    eq(metricsIngestState.source, source),
  );

async function getState(projectId: string, source: MetricsSource) {
  const [row] = await db
    .select()
    .from(metricsIngestState)
    .where(stateKey(projectId, source))
    .limit(1);
  return row ?? null;
}

async function ensureState(projectId: string, source: MetricsSource) {
  await db
    .insert(metricsIngestState)
    .values({ projectId, source })
    .onConflictDoNothing({
      target: [metricsIngestState.projectId, metricsIngestState.source],
    });
}

// One UPDATE: wins only when unclaimed or the previous claim is stale.
// Rows come back from RETURNING so this works on D1 and Postgres alike.
async function claim(
  projectId: string,
  source: MetricsSource,
  nowIso: string,
  staleBeforeIso: string,
) {
  const rows = await db
    .update(metricsIngestState)
    .set({ claimedAt: nowIso, lastRunAt: nowIso, updatedAt: nowIso })
    .where(
      and(
        stateKey(projectId, source),
        sql`(${metricsIngestState.claimedAt} IS NULL OR ${metricsIngestState.claimedAt} < ${staleBeforeIso})`,
      ),
    )
    .returning({ id: metricsIngestState.id });
  return rows.length > 0;
}

async function release(
  projectId: string,
  source: MetricsSource,
  patch: IngestStatePatch,
) {
  await db
    .update(metricsIngestState)
    .set({ ...patch, claimedAt: null, updatedAt: now() })
    .where(stateKey(projectId, source));
}

export const MetricsHistoryRepository = {
  ...metricsHistoryReads,
  listGscConnections,
  listGa4Connections,
  upsertGscSite,
  upsertGscPage,
  upsertGscQueryPage,
  upsertGa4Total,
  upsertGa4Channel,
  upsertGa4LandingPage,
  upsertGa4KeyEvent,
  getState,
  ensureState,
  claim,
  release,
};
