import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type {
  DateWindow,
  GscInsightsDevice,
  InsightsDailyRow,
} from "@/types/schemas/gsc-insights";

// Read-only SQL behind the GSC Insights page. Every statement filters on
// (project_id, date) first, so it rides the (project_id, date) index on
// gsc_daily_query_page and the unique indexes on the site and page tables.
// A two-window read (current and compare) is ONE statement: conditional sums
// over the union of both windows, never a loop per day.

export type InsightsCoverage = {
  start: string;
  end: string;
  finalizedThrough: string | null;
};
export type InsightsDimensionRow = {
  dim: string;
  clicks: number;
  impressions: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosition: number;
};
export type InsightsMover = InsightsDimensionRow & { side: "gain" | "loss" };

const num = (value: unknown) => Number(value ?? 0);

// Stored device values are GSC's own (DESKTOP, MOBILE, TABLET); '' is all.
const deviceClause = (column: SQL, device: GscInsightsDevice) =>
  device === "all" ? sql`1 = 1` : sql`${column} = ${device.toUpperCase()}`;

const windowsClause = (current: DateWindow, compare: DateWindow | null) =>
  compare
    ? sql`(date BETWEEN ${current.start} AND ${current.end} OR date BETWEEN ${compare.start} AND ${compare.end})`
    : sql`date BETWEEN ${current.start} AND ${current.end}`;

const inWindow = (w: DateWindow) => sql`date BETWEEN ${w.start} AND ${w.end}`;

// Conditional sums for the current window (c*) and compare window (p*).
function conditionalSums(current: DateWindow, compare: DateWindow | null) {
  const prev = (expr: SQL) =>
    compare
      ? sql`sum(CASE WHEN ${inWindow(compare)} THEN ${expr} END)`
      : sql`0`;
  const cur = (expr: SQL) =>
    sql`sum(CASE WHEN ${inWindow(current)} THEN ${expr} END)`;
  return {
    clicks: cur(sql`clicks`),
    impressions: cur(sql`impressions`),
    posWeighted: cur(sql`position * impressions`),
    prevClicks: prev(sql`clicks`),
    prevImpressions: prev(sql`impressions`),
    prevPosWeighted: prev(sql`position * impressions`),
  };
}

type RawDimension = {
  dim: string;
  clicks: number | null;
  impressions: number | null;
  posWeighted: number | null;
  prevClicks: number | null;
  prevImpressions: number | null;
  prevPosWeighted: number | null;
  side?: string;
};

function toDimensionRow(row: RawDimension): InsightsDimensionRow {
  const impressions = num(row.impressions);
  const prevImpressions = num(row.prevImpressions);
  return {
    dim: row.dim,
    clicks: num(row.clicks),
    impressions,
    position: impressions > 0 ? num(row.posWeighted) / impressions : 0,
    prevClicks: num(row.prevClicks),
    prevImpressions,
    prevPosition:
      prevImpressions > 0 ? num(row.prevPosWeighted) / prevImpressions : 0,
  };
}

/** Newest stored all-device day, the oldest, and the newest finalized day. */
async function getCoverage(
  projectId: string,
): Promise<InsightsCoverage | null> {
  const [row] = await db.all<{
    start: string | null;
    end: string | null;
    finalizedThrough: string | null;
  }>(sql`
    SELECT min(date) AS start, max(date) AS end,
      max(CASE WHEN finalized THEN date END) AS finalizedThrough
    FROM gsc_daily_site
    WHERE project_id = ${projectId} AND device = ''
  `);
  if (!row?.start || !row.end) return null;
  return {
    start: row.start,
    end: row.end,
    finalizedThrough: row.finalizedThrough,
  };
}

/** Daily site series for both windows in one statement. Device rows are
 *  summed, with position weighted by impressions. */
async function getDailySeries(
  projectId: string,
  current: DateWindow,
  compare: DateWindow | null,
  device: GscInsightsDevice,
): Promise<InsightsDailyRow[]> {
  const deviceFilter =
    device === "all" ? sql`device = ''` : deviceClause(sql`device`, device);
  const rows = await db.all<{
    date: string;
    clicks: number;
    impressions: number;
    posWeighted: number;
  }>(sql`
    SELECT date, sum(clicks) AS clicks, sum(impressions) AS impressions,
      sum(position * impressions) AS posWeighted
    FROM gsc_daily_site
    WHERE project_id = ${projectId} AND ${windowsClause(current, compare)}
      AND ${deviceFilter}
    GROUP BY date ORDER BY date
  `);
  return rows.map((row) => {
    const impressions = num(row.impressions);
    const clicks = num(row.clicks);
    return {
      date: row.date,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: impressions > 0 ? num(row.posWeighted) / impressions : 0,
    };
  });
}

/** Per-device clicks and impressions for one window. */
async function getDeviceSplit(
  projectId: string,
  window: DateWindow,
): Promise<{ device: string; clicks: number; impressions: number }[]> {
  const rows = await db.all<{
    device: string;
    clicks: number;
    impressions: number;
  }>(sql`
    SELECT device, sum(clicks) AS clicks, sum(impressions) AS impressions
    FROM gsc_daily_site
    WHERE project_id = ${projectId} AND device != '' AND ${inWindow(window)}
    GROUP BY device
  `);
  return rows.map((row) => ({
    device: row.device.toLowerCase(),
    clicks: num(row.clicks),
    impressions: num(row.impressions),
  }));
}

/** Impressions per ranking bucket, one GROUP BY over query_page rows. Each
 *  row's own position decides its bucket; impressions are the weight. */
async function getPositionBuckets(
  projectId: string,
  window: DateWindow,
  device: GscInsightsDevice,
): Promise<{ top3: number; top10: number; top20: number; beyond: number }> {
  const rows = await db.all<{ bucket: string; impressions: number }>(sql`
    SELECT CASE
        WHEN position < 4 THEN 'top3'
        WHEN position < 11 THEN 'top10'
        WHEN position < 21 THEN 'top20'
        ELSE 'beyond' END AS bucket,
      sum(impressions) AS impressions
    FROM gsc_daily_query_page
    WHERE project_id = ${projectId} AND ${inWindow(window)}
      AND ${deviceClause(sql`device`, device)}
    GROUP BY bucket
  `);
  const out = { top3: 0, top10: 0, top20: 0, beyond: 0 };
  for (const row of rows) {
    const bucket = row.bucket;
    if (
      bucket === "top3" ||
      bucket === "top10" ||
      bucket === "top20" ||
      bucket === "beyond"
    )
      out[bucket] = num(row.impressions);
  }
  return out;
}

type Dimension = "query" | "page";

/** Source table for a dimension. Pages use the page table (exact totals) for
 *  all devices; a device filter needs the per-device query_page rows. */
function dimensionSource(dimension: Dimension, device: GscInsightsDevice) {
  if (dimension === "query")
    return { table: sql.raw("gsc_daily_query_page"), column: sql.raw("query") };
  return device === "all"
    ? { table: sql.raw("gsc_daily_page"), column: sql.raw("page") }
    : { table: sql.raw("gsc_daily_query_page"), column: sql.raw("page") };
}

function dimensionFilter(dimension: Dimension, device: GscInsightsDevice): SQL {
  return dimension === "page" && device === "all"
    ? sql`1 = 1`
    : deviceClause(sql`device`, device);
}

/** Top rows by clicks in the current window, with compare-window values. */
async function getTopByClicks(
  projectId: string,
  current: DateWindow,
  compare: DateWindow | null,
  options: { dimension: Dimension; device: GscInsightsDevice; limit: number },
): Promise<InsightsDimensionRow[]> {
  const { dimension, device, limit } = options;
  const { table, column } = dimensionSource(dimension, device);
  const sums = conditionalSums(current, compare);
  const rows = await db.all<RawDimension>(sql`
    SELECT ${column} AS dim, ${sums.clicks} AS clicks,
      ${sums.impressions} AS impressions, ${sums.posWeighted} AS posWeighted,
      ${sums.prevClicks} AS prevClicks,
      ${sums.prevImpressions} AS prevImpressions,
      ${sums.prevPosWeighted} AS prevPosWeighted
    FROM ${table}
    WHERE project_id = ${projectId} AND ${windowsClause(current, compare)}
      AND ${dimensionFilter(dimension, device)}
    GROUP BY ${column}
    HAVING sum(CASE WHEN ${inWindow(current)} THEN impressions END) > 0
    ORDER BY clicks DESC, impressions DESC
    LIMIT ${limit}
  `);
  return rows.map(toDimensionRow);
}

/** Biggest click gainers and losers between the windows, in one statement:
 *  one aggregation (CTE), two LIMITed slices of it. A query needs at least
 *  `minImpressions` in either window to qualify. */
async function getMovers(
  projectId: string,
  current: DateWindow,
  compare: DateWindow,
  device: GscInsightsDevice,
  options: { limit: number; minImpressions: number },
): Promise<InsightsMover[]> {
  const sums = conditionalSums(current, compare);
  const rows = await db.all<RawDimension>(sql`
    WITH agg AS (
      SELECT query AS dim, coalesce(${sums.clicks}, 0) AS clicks,
        coalesce(${sums.impressions}, 0) AS impressions,
        coalesce(${sums.posWeighted}, 0) AS posWeighted,
        coalesce(${sums.prevClicks}, 0) AS prevClicks,
        coalesce(${sums.prevImpressions}, 0) AS prevImpressions,
        coalesce(${sums.prevPosWeighted}, 0) AS prevPosWeighted
      FROM gsc_daily_query_page
      WHERE project_id = ${projectId} AND ${windowsClause(current, compare)}
        AND ${deviceClause(sql`device`, device)}
      GROUP BY query
      HAVING coalesce(${sums.impressions}, 0) >= ${options.minImpressions}
        OR coalesce(${sums.prevImpressions}, 0) >= ${options.minImpressions}
    )
    SELECT * FROM (
      SELECT *, 'gain' AS side FROM agg WHERE clicks > prevClicks
      ORDER BY clicks - prevClicks DESC, impressions DESC LIMIT ${options.limit}
    )
    UNION ALL
    SELECT * FROM (
      SELECT *, 'loss' AS side FROM agg WHERE clicks < prevClicks
      ORDER BY clicks - prevClicks ASC, prevImpressions DESC LIMIT ${options.limit}
    )
  `);
  return rows.map((row) => ({
    ...toDimensionRow(row),
    side: row.side === "loss" ? "loss" : "gain",
  }));
}

export const gscInsightsReads = {
  getCoverage,
  getDailySeries,
  getDeviceSplit,
  getPositionBuckets,
  getTopByClicks,
  getMovers,
};
