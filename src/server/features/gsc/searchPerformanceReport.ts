import { sort } from "remeda";
import { launchComparison } from "@/client/features/overview/overviewRange";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import { BRAND_TERMS, isBrandQuery } from "@/shared/brandQueries";
import type { SearchPerformanceDateRange } from "@/types/schemas/search-performance";
import { SITE_LAUNCH_DATE } from "@/types/schemas/traffic";

/**
 * Pure shaping helpers for the Search Performance page. Kept separate from the
 * server function so the aggregation and striking-distance rules are unit
 * testable without a GSC client.
 */

type SearchPerformanceTotals = {
  clicks: number;
  impressions: number;
  /** 0..1 (clicks / impressions). */
  ctr: number;
  /** Impression-weighted average position; 0 when there were no impressions. */
  position: number;
};

type SearchPerformanceDimensionRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type StrikingDistanceRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
};

// "Striking distance" = already ranking, not yet in the top spots: the queries
// where a content improvement most plausibly moves real traffic.
const STRIKING_DISTANCE_MIN_POSITION = 5;
const STRIKING_DISTANCE_MAX_POSITION = 20;
const STRIKING_DISTANCE_ROW_LIMIT = 100;

export function sumSearchTotals(
  rows: GscSearchAnalyticsRow[],
): SearchPerformanceTotals {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

/** Flatten single-dimension rows (query or page) into a keyed table row. */
export function toDimensionRows(
  rows: GscSearchAnalyticsRow[],
): SearchPerformanceDimensionRow[] {
  const output: SearchPerformanceDimensionRow[] = [];
  for (const row of rows) {
    const key = row.keys?.[0];
    if (!key) continue;
    output.push({
      key,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }
  return output;
}

/** Reduce `["query","page"]` rows to one striking-distance row per query.
 *
 *  GSC returns a row per page that ranks for a query, so a query fans out across
 *  every page it appears on. A query only belongs in "striking distance" when
 *  the site's BEST-ranking page for it sits in the 5..20 band — if any page
 *  already ranks above position 5, the site effectively ranks near the top and
 *  improving a secondary page won't move traffic. So we collapse each query to
 *  its top page (lowest average position; ties broken by impressions) and keep
 *  it only when that top page is in band. Result is sorted by impressions. */
export function buildStrikingDistanceRows(
  rows: GscSearchAnalyticsRow[],
  limit: number = STRIKING_DISTANCE_ROW_LIMIT,
): StrikingDistanceRow[] {
  const topPageByQuery = new Map<string, StrikingDistanceRow>();
  for (const row of rows) {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (!query || !page) continue;

    const current = topPageByQuery.get(query);
    const isBetter =
      !current ||
      row.position < current.position ||
      (row.position === current.position &&
        row.impressions > current.impressions);
    if (!isBetter) continue;

    topPageByQuery.set(query, {
      query,
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    });
  }

  return sort(
    Array.from(topPageByQuery.values()).filter(
      (row) =>
        row.position >= STRIKING_DISTANCE_MIN_POSITION &&
        row.position <= STRIKING_DISTANCE_MAX_POSITION,
    ),
    (a, b) => b.impressions - a.impressions,
  ).slice(0, limit);
}

/** The same-length period immediately before [startDate, endDate], for the
 *  totals comparison. Dates are YYYY-MM-DD in UTC. */
export function previousPeriod(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const lengthMs = Math.max(end - start, 0);
  const prevEnd = start - dayMs;
  const prevStart = prevEnd - lengthMs;
  return {
    startDate: formatUtcDate(prevStart),
    endDate: formatUtcDate(prevEnd),
  };
}

function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type SearchWindows = {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  /** Multiplier for the reference window's additive totals (clicks,
   *  impressions) so it reads per the same number of days as the current
   *  window. 1 for a plain previous period. */
  scale: number;
  /** "launch" when the reference is the 12 weeks before launch. */
  baseline: "launch" | "previous";
};

/** Current and reference windows for a Search Performance range.
 *
 *  `since_launch` runs from the launch date to the latest data day and is
 *  compared with the 12 weeks before launch, scaled to the same number of days
 *  (the Overview's comparison, via launchComparison). Every other range is
 *  compared with the same-length period just before it. If the launch date is
 *  not reached yet, `since_launch` falls back to the last 28 days. */
export function resolveSearchWindows(
  dateRange: SearchPerformanceDateRange,
  today: Date = new Date(),
  launch: string = SITE_LAUNCH_DATE,
): SearchWindows {
  if (dateRange === "since_launch") {
    const { endDate: latest } = resolveDateRange(
      { dateRange: "last_7_days" },
      today,
    );
    const pair = launchComparison(launch, latest);
    if (pair) {
      return {
        startDate: pair.current.start,
        endDate: pair.current.end,
        prevStartDate: pair.reference.start,
        prevEndDate: pair.reference.end,
        scale: pair.reference.scale,
        baseline: "launch",
      };
    }
  }
  const { startDate, endDate } = resolveDateRange(
    {
      dateRange: dateRange === "since_launch" ? "last_28_days" : dateRange,
    },
    today,
  );
  const prev = previousPeriod(startDate, endDate);
  return {
    startDate,
    endDate,
    prevStartDate: prev.startDate,
    prevEndDate: prev.endDate,
    scale: 1,
    baseline: "previous",
  };
}

/** Bring a reference window's totals to the current window's length. Clicks
 *  and impressions are additive so they scale; CTR and position are ratios
 *  and stay as they are. */
export function scaleTotals(
  totals: SearchPerformanceTotals,
  scale: number,
): SearchPerformanceTotals {
  return {
    ...totals,
    clicks: totals.clicks * scale,
    impressions: totals.impressions * scale,
  };
}

export type MoverRow = {
  query: string;
  isBrand: boolean;
  clicks: number;
  /** Reference-window clicks, already scaled to the current window length. */
  prevClicks: number;
  clickChange: number;
  impressions: number;
  /** Null when the query had no impressions in the window. */
  position: number | null;
  prevPosition: number | null;
  /** Previous minus current, so positive means the query moved up. Null when
   *  the query is missing from either window. */
  positionChange: number | null;
};

const MOVERS_ROW_LIMIT = 100;

/** Queries whose clicks or position changed most between the reference and
 *  current windows. Ranked by absolute click change, then absolute position
 *  change, then impressions. Queries that did not move at all are dropped.
 *  GSC returns each window's top queries only, so a query outside the top rows
 *  of the reference window can read as new. */
export function buildMovers(
  current: GscSearchAnalyticsRow[],
  previous: GscSearchAnalyticsRow[],
  scale: number,
  terms: readonly string[] = BRAND_TERMS,
  limit: number = MOVERS_ROW_LIMIT,
): MoverRow[] {
  const prevByQuery = new Map<string, GscSearchAnalyticsRow>();
  for (const row of previous) {
    const query = row.keys?.[0];
    if (query) prevByQuery.set(query, row);
  }
  const seen = new Set<string>();
  const rows: MoverRow[] = [];
  const push = (
    query: string,
    now: GscSearchAnalyticsRow | undefined,
    before: GscSearchAnalyticsRow | undefined,
  ) => {
    const clicks = now?.clicks ?? 0;
    const prevClicks = (before?.clicks ?? 0) * scale;
    const position = now && now.impressions > 0 ? now.position : null;
    const prevPosition =
      before && before.impressions > 0 ? before.position : null;
    const positionChange =
      position !== null && prevPosition !== null
        ? prevPosition - position
        : null;
    const clickChange = clicks - prevClicks;
    if (clickChange === 0 && (positionChange === null || positionChange === 0))
      return;
    rows.push({
      query,
      isBrand: isBrandQuery(query, terms),
      clicks,
      prevClicks,
      clickChange,
      impressions: now?.impressions ?? 0,
      position,
      prevPosition,
      positionChange,
    });
  };
  for (const row of current) {
    const query = row.keys?.[0];
    if (!query) continue;
    seen.add(query);
    push(query, row, prevByQuery.get(query));
  }
  for (const [query, row] of prevByQuery) {
    if (!seen.has(query)) push(query, undefined, row);
  }
  return sort(
    rows,
    (a, b) =>
      Math.abs(b.clickChange) - Math.abs(a.clickChange) ||
      Math.abs(b.positionChange ?? 0) - Math.abs(a.positionChange ?? 0) ||
      b.impressions - a.impressions,
  ).slice(0, limit);
}
