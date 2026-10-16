import type { ga4Connections, gscConnections } from "@/db/schema";
import { ingestGa4Window, findGa4PropertyStart } from "./Ga4IngestService";
import { ingestGscWindow } from "./GscIngestService";
import { shiftDate } from "./ingestDates";
import {
  MetricsHistoryRepository as repo,
  type MetricsSource,
} from "./MetricsHistoryRepository";

// Wall-clock guard for the loop. Stopping early is safe: unclaimed items stay
// due and the next tick resumes them.
const TICK_DEADLINE_MS = 10 * 60_000;
// A claim older than this is a crashed tick and may be taken over.
const CLAIM_STALE_MS = 20 * 60_000;
// Daily refresh cadence once the backfill is done.
const REFRESH_AFTER_MS = 20 * 60 * 60_000;
const BACKFILL_WINDOW_DAYS = 31;
// A backfilling item keeps walking windows within one tick until this budget
// is spent, so a 16-month history lands in one or two ticks instead of one
// window per tick. The cursor is released after every window, so a kill
// mid-walk loses at most the window in flight.
const ITEM_BACKFILL_BUDGET_MS = 6 * 60_000;
// GSC keeps 16 months; 485 days matches the cap in searchAnalytics.ts.
const GSC_FLOOR_DAYS = 485;
const GSC_LAG_DAYS = 3;
const GA4_LAG_DAYS = 1;

type Counters = {
  considered: number;
  claimed: number;
  alreadyClaimed: number;
  backfilled: number;
  refreshed: number;
  upToDate: number;
  failed: number;
  stoppedByDeadline: boolean;
};

/** Class name plus message, with bearer tokens removed, capped at 500 chars. */
function sanitizeError(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  return `${name}: ${message}`
    .replace(/ya29\.[\w-]+|Bearer \S+/g, "[redacted]")
    .slice(0, 500);
}

type Item =
  | { source: "gsc"; connection: typeof gscConnections.$inferSelect }
  | { source: "ga4"; connection: typeof ga4Connections.$inferSelect };

async function ingest(item: Item, start: string, end: string, today: string) {
  if (item.source === "gsc")
    await ingestGscWindow(item.connection, start, end, { today });
  else await ingestGa4Window(item.connection, start, end);
}

async function processItem(
  item: Item,
  now: Date,
  counters: Counters,
): Promise<void> {
  const { source } = item;
  const projectId = item.connection.projectId;
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);

  await repo.ensureState(projectId, source);
  const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
  if (!(await repo.claim(projectId, source, nowIso, staleBefore))) {
    counters.alreadyClaimed += 1;
    return;
  }
  counters.claimed += 1;
  try {
    const state = await repo.getState(projectId, source);
    const latest = shiftDate(
      today,
      source === "gsc" ? -GSC_LAG_DAYS : -GA4_LAG_DAYS,
    );
    if (state && !state.backfillDone) {
      const floor =
        item.source === "gsc"
          ? shiftDate(today, -GSC_FLOOR_DAYS)
          : await findGa4PropertyStart(item.connection);
      if (floor === null) {
        // Property has no data at all: nothing to backfill.
        await repo.release(projectId, source, {
          backfillDone: true,
          lastSuccessAt: nowIso,
          lastError: null,
        });
        counters.backfilled += 1;
        return;
      }
      const budgetEnd = Date.now() + ITEM_BACKFILL_BUDGET_MS;
      let cursor = state.backfillCursorDate ?? latest;
      let done = false;
      while (!done) {
        const windowEnd = cursor;
        const earliest = shiftDate(windowEnd, -(BACKFILL_WINDOW_DAYS - 1));
        const windowStart = earliest < floor ? floor : earliest;
        if (windowStart <= windowEnd)
          await ingest(item, windowStart, windowEnd, today);
        cursor = shiftDate(windowStart, -1);
        done = windowStart <= floor;
        // Persist progress after every window; a kill loses only the window
        // in flight. The claim is re-taken for the next window.
        await repo.release(projectId, source, {
          backfillCursorDate: cursor,
          backfillDone: done,
          lastSuccessAt: nowIso,
          lastError: null,
        });
        if (done || Date.now() >= budgetEnd) break;
        if (!(await repo.claim(projectId, source, nowIso, staleBefore))) break;
      }
      counters.backfilled += 1;
      return;
    }
    const last = state?.lastSuccessAt ? Date.parse(state.lastSuccessAt) : NaN;
    if (Number.isNaN(last) || now.getTime() - last > REFRESH_AFTER_MS) {
      const start = shiftDate(today, source === "gsc" ? -8 : -4);
      await ingest(item, start, latest, today);
      await repo.release(projectId, source, {
        lastSuccessAt: nowIso,
        lastError: null,
      });
      counters.refreshed += 1;
      return;
    }
    await repo.release(projectId, source, {});
    counters.upToDate += 1;
  } catch (error) {
    counters.failed += 1;
    console.error(
      `[metrics-ingest] failed projectId=${projectId} source=${source}`,
      error,
    );
    await repo.release(projectId, source, { lastError: sanitizeError(error) });
  }
}

// Cron body: advance the GSC/GA4 history backfill and daily refresh for every
// connected project. Wrapped in `withPgClient` at the entrypoint (server.ts).
export async function runScheduledMetricsIngest(now = new Date()) {
  const [gscList, ga4List] = await Promise.all([
    repo.listGscConnections(),
    repo.listGa4Connections(),
  ]);
  const items: Item[] = [
    ...gscList.map((connection) => ({ source: "gsc" as const, connection })),
    ...ga4List.map((connection) => ({ source: "ga4" as const, connection })),
  ];
  const counters: Counters = {
    considered: items.length,
    claimed: 0,
    alreadyClaimed: 0,
    backfilled: 0,
    refreshed: 0,
    upToDate: 0,
    failed: 0,
    stoppedByDeadline: false,
  };
  const deadline = Date.now() + TICK_DEADLINE_MS;
  for (const item of items) {
    if (Date.now() >= deadline) {
      counters.stoppedByDeadline = true;
      break;
    }
    try {
      await processItem(item, now, counters);
    } catch (error) {
      // Bookkeeping (ensureState/claim/release) failed; keep the tick alive.
      counters.failed += 1;
      console.error(
        `[metrics-ingest] bookkeeping failed projectId=${item.connection.projectId} source=${item.source satisfies MetricsSource}`,
        error,
      );
    }
  }
  console.log("[metrics-ingest] tick complete", counters);
  if (counters.failed > 0)
    console.error("[metrics-ingest] items failed", counters);
  return counters;
}
