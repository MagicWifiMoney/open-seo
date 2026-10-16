import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  max,
  min,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  ga4DailyChannel,
  ga4DailyKeyEvent,
  ga4DailyLandingPage,
  ga4DailyTotal,
  gscDailyPage,
  gscDailyQueryPage,
  gscDailySite,
} from "@/db/schema";

async function coverage(projectId: string) {
  const [gsc] = await db
    .select({
      minDate: min(gscDailySite.date),
      maxDate: max(gscDailySite.date),
      maxFinalizedDate: max(
        sql<
          string | null
        >`CASE WHEN ${gscDailySite.finalized} THEN ${gscDailySite.date} END`,
      ),
      rows: count(),
    })
    .from(gscDailySite)
    .where(
      and(eq(gscDailySite.projectId, projectId), eq(gscDailySite.device, "")),
    );
  const [ga4] = await db
    .select({
      minDate: min(ga4DailyTotal.date),
      maxDate: max(ga4DailyTotal.date),
      rows: count(),
    })
    .from(ga4DailyTotal)
    .where(eq(ga4DailyTotal.projectId, projectId));
  const rowCount = async (
    table:
      | typeof gscDailyPage
      | typeof gscDailyQueryPage
      | typeof ga4DailyChannel
      | typeof ga4DailyLandingPage
      | typeof ga4DailyKeyEvent,
  ) => {
    const [row] = await db
      .select({ rows: count() })
      .from(table)
      .where(eq(table.projectId, projectId));
    return row?.rows ?? 0;
  };
  return {
    gsc: {
      minDate: gsc?.minDate ?? null,
      maxDate: gsc?.maxDate ?? null,
      maxFinalizedDate: gsc?.maxFinalizedDate ?? null,
    },
    ga4: { minDate: ga4?.minDate ?? null, maxDate: ga4?.maxDate ?? null },
    rowCounts: {
      gscDailySite: gsc?.rows ?? 0,
      gscDailyPage: await rowCount(gscDailyPage),
      gscDailyQueryPage: await rowCount(gscDailyQueryPage),
      ga4DailyTotal: ga4?.rows ?? 0,
      ga4DailyChannel: await rowCount(ga4DailyChannel),
      ga4DailyLandingPage: await rowCount(ga4DailyLandingPage),
      ga4DailyKeyEvent: await rowCount(ga4DailyKeyEvent),
    },
  };
}

const inRange = (
  table:
    | typeof gscDailySite
    | typeof gscDailyPage
    | typeof gscDailyQueryPage
    | typeof ga4DailyTotal
    | typeof ga4DailyChannel
    | typeof ga4DailyLandingPage
    | typeof ga4DailyKeyEvent,
  projectId: string,
  start: string,
  end: string,
) =>
  and(
    eq(table.projectId, projectId),
    gte(table.date, start),
    lte(table.date, end),
  );

async function getGscSite(projectId: string, start: string, end: string) {
  return db
    .select()
    .from(gscDailySite)
    .where(inRange(gscDailySite, projectId, start, end))
    .orderBy(asc(gscDailySite.date), asc(gscDailySite.device));
}

// Pages and query/page rows are capped by `limit`, so they are ranked by the
// metric first (date is the tiebreaker) to keep the top rows.
async function getGscPage(
  projectId: string,
  start: string,
  end: string,
  limit: number,
) {
  return db
    .select()
    .from(gscDailyPage)
    .where(inRange(gscDailyPage, projectId, start, end))
    .orderBy(desc(gscDailyPage.clicks), asc(gscDailyPage.date))
    .limit(limit);
}

async function getGscQueryPage(
  projectId: string,
  start: string,
  end: string,
  options: { limit: number; orderBy: "clicks" | "impressions" },
) {
  return db
    .select()
    .from(gscDailyQueryPage)
    .where(inRange(gscDailyQueryPage, projectId, start, end))
    .orderBy(
      desc(gscDailyQueryPage[options.orderBy]),
      asc(gscDailyQueryPage.date),
    )
    .limit(options.limit);
}

async function getGa4Total(projectId: string, start: string, end: string) {
  return db
    .select()
    .from(ga4DailyTotal)
    .where(inRange(ga4DailyTotal, projectId, start, end))
    .orderBy(asc(ga4DailyTotal.date));
}

async function getGa4Channel(projectId: string, start: string, end: string) {
  return db
    .select()
    .from(ga4DailyChannel)
    .where(inRange(ga4DailyChannel, projectId, start, end))
    .orderBy(asc(ga4DailyChannel.date), asc(ga4DailyChannel.channelGroup));
}

async function getGa4LandingPage(
  projectId: string,
  start: string,
  end: string,
) {
  return db
    .select()
    .from(ga4DailyLandingPage)
    .where(inRange(ga4DailyLandingPage, projectId, start, end))
    .orderBy(asc(ga4DailyLandingPage.date));
}

async function getGa4KeyEvent(projectId: string, start: string, end: string) {
  return db
    .select()
    .from(ga4DailyKeyEvent)
    .where(inRange(ga4DailyKeyEvent, projectId, start, end))
    .orderBy(asc(ga4DailyKeyEvent.date));
}

/** Per-query totals over a window, summed across pages and devices. Position
 *  is impression-weighted; queries with no impressions are skipped. */
async function getGscQueryTotals(
  projectId: string,
  start: string,
  end: string,
  options: { finalizedOnly: boolean },
) {
  const impressions = sql<number>`sum(${gscDailyQueryPage.impressions})`;
  const clicks = sql<number>`sum(${gscDailyQueryPage.clicks})`;
  const rows = await db
    .select({
      query: gscDailyQueryPage.query,
      clicks,
      impressions,
      position: sql<number>`sum(${gscDailyQueryPage.position} * ${gscDailyQueryPage.impressions}) * 1.0 / sum(${gscDailyQueryPage.impressions})`,
    })
    .from(gscDailyQueryPage)
    .where(
      and(
        inRange(gscDailyQueryPage, projectId, start, end),
        options.finalizedOnly
          ? eq(gscDailyQueryPage.finalized, true)
          : undefined,
      ),
    )
    .groupBy(gscDailyQueryPage.query)
    .having(sql`sum(${gscDailyQueryPage.impressions}) > 0`)
    .orderBy(desc(clicks), desc(impressions));
  return rows.map((row) => ({
    query: row.query,
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    position: Number(row.position),
  }));
}

/**
 * Latest stored all-device site day, or null. Gates the dashboard's stored
 * path: rows are refreshed daily for the trailing window, so coverage through
 * the window end is what matters, not the 5-day finalized flag (the dashboard
 * window ends 3 days back, so a finalized-only gate would never open).
 */
async function getGscCoverageEnd(projectId: string) {
  const [row] = await db
    .select({ date: max(gscDailySite.date) })
    .from(gscDailySite)
    .where(
      and(eq(gscDailySite.projectId, projectId), eq(gscDailySite.device, "")),
    );
  return row?.date ?? null;
}

/** Latest day whose all-device site row is final, or null. */
async function getGscFinalizedThrough(projectId: string) {
  const [row] = await db
    .select({ date: max(gscDailySite.date) })
    .from(gscDailySite)
    .where(
      and(
        eq(gscDailySite.projectId, projectId),
        eq(gscDailySite.device, ""),
        eq(gscDailySite.finalized, true),
      ),
    );
  return row?.date ?? null;
}

/** Latest day with a stored GA4 total row, or null. */
async function getGa4CoverageEnd(projectId: string) {
  const [row] = await db
    .select({ date: max(ga4DailyTotal.date) })
    .from(ga4DailyTotal)
    .where(eq(ga4DailyTotal.projectId, projectId));
  return row?.date ?? null;
}

export const metricsHistoryReads = {
  coverage,
  getGscQueryTotals,
  getGscCoverageEnd,
  getGscFinalizedThrough,
  getGa4CoverageEnd,
  getGscSite,
  getGscPage,
  getGscQueryPage,
  getGa4Total,
  getGa4Channel,
  getGa4LandingPage,
  getGa4KeyEvent,
};
