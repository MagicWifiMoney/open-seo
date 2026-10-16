import { sort } from "remeda";
import {
  gscInsightsReads as reads,
  type InsightsDimensionRow,
} from "./gscInsightsReads";
import { resolveCompareWindow, resolveWindow } from "./gscInsightsWindows";
import type {
  DateWindow,
  CompareCoverage,
  GscInsights,
  GscInsightsCompare,
  GscInsightsDevice,
  GscInsightsRange,
  InsightsDailyRow,
  InsightsDelta,
  InsightsRow,
  InsightsTotals,
  InsightsTotalsWithDelta,
} from "@/types/schemas/gsc-insights";

const TOP_LIMIT = 50;
const MOVERS_LIMIT = 10;
const MOVERS_MIN_IMPRESSIONS = 5;

export function sumDaily(rows: InsightsDailyRow[]): InsightsTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weighted += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weighted / impressions : 0,
  };
}

function delta(now: number, before: number): InsightsDelta {
  return {
    absolute: now - before,
    percent: before === 0 ? null : ((now - before) / before) * 100,
  };
}

export function computeDeltas(
  totals: InsightsTotals,
  before: InsightsTotals,
): InsightsTotalsWithDelta {
  return {
    clicks: delta(totals.clicks, before.clicks),
    impressions: delta(totals.impressions, before.impressions),
    ctr: delta(totals.ctr, before.ctr),
    position: delta(totals.position, before.position),
  };
}

function toRow(row: InsightsDimensionRow): InsightsRow {
  return {
    key: row.dim,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    position: row.position,
    prevClicks: row.prevClicks,
    prevImpressions: row.prevImpressions,
    prevPosition: row.prevPosition,
    clicksDelta: row.clicks - row.prevClicks,
    impressionsDelta: row.impressions - row.prevImpressions,
    positionDelta:
      row.prevImpressions > 0 && row.impressions > 0
        ? row.position - row.prevPosition
        : null,
  };
}

const share = (part: number, total: number) => (total > 0 ? part / total : 0);

async function getInsights(input: {
  projectId: string;
  range: GscInsightsRange;
  from?: string;
  to?: string;
  compare: GscInsightsCompare;
  device: GscInsightsDevice;
}): Promise<GscInsights> {
  const { projectId, device } = input;
  const coverage = await reads.getCoverage(projectId);
  if (!coverage) return { coverage: null };

  const window = resolveWindow(input, coverage);
  const requestedCompare = resolveCompareWindow(window, input.compare);
  // A compare window that starts before stored history would read missing days
  // as zeros and report the full current value as the change. Drop it instead.
  const compareCoverage: CompareCoverage = !requestedCompare
    ? "none"
    : requestedCompare.start >= coverage.start
      ? "full"
      : requestedCompare.end >= coverage.start
        ? "partial"
        : "none";
  const compareWindow = compareCoverage === "full" ? requestedCompare : null;

  const [series, split, buckets, queries, pages, movers] = await Promise.all([
    reads.getDailySeries(projectId, window, compareWindow, device),
    reads.getDeviceSplit(projectId, window),
    reads.getPositionBuckets(projectId, window, device),
    reads.getTopByClicks(projectId, window, compareWindow, {
      dimension: "query",
      device,
      limit: TOP_LIMIT,
    }),
    reads.getTopByClicks(projectId, window, compareWindow, {
      dimension: "page",
      device,
      limit: TOP_LIMIT,
    }),
    compareWindow
      ? reads.getMovers(projectId, window, compareWindow, device, {
          limit: MOVERS_LIMIT,
          minImpressions: MOVERS_MIN_IMPRESSIONS,
        })
      : Promise.resolve([]),
  ]);

  const inWindow = (w: DateWindow) => (row: InsightsDailyRow) =>
    row.date >= w.start && row.date <= w.end;
  const daily = series.filter(inWindow(window));
  const compareDaily = compareWindow
    ? series.filter(inWindow(compareWindow))
    : [];
  const totals = sumDaily(daily);
  const compareTotals = compareWindow ? sumDaily(compareDaily) : null;

  const splitClicks = split.reduce((sum, row) => sum + row.clicks, 0);
  const splitImpressions = split.reduce((sum, row) => sum + row.impressions, 0);
  const bucketTotal =
    buckets.top3 + buckets.top10 + buckets.top20 + buckets.beyond;
  const toMover = (side: "gain" | "loss") =>
    sort(movers.filter((row) => row.side === side).map(toRow), (a, b) =>
      side === "gain"
        ? b.clicksDelta - a.clicksDelta
        : a.clicksDelta - b.clicksDelta,
    );

  return {
    coverage,
    window,
    compareWindow,
    daily,
    compareDaily,
    totals,
    compareTotals,
    compareCoverage,
    deltas:
      compareTotals && compareTotals.impressions > 0
        ? computeDeltas(totals, compareTotals)
        : null,
    deviceSplit: sort(
      split.map((row) => ({
        ...row,
        clicksShare: share(row.clicks, splitClicks),
        impressionsShare: share(row.impressions, splitImpressions),
      })),
      (a, b) => b.clicks - a.clicks,
    ),
    positionBuckets: {
      ...buckets,
      total: bucketTotal,
      shares: {
        top3: share(buckets.top3, bucketTotal),
        top10: share(buckets.top10, bucketTotal),
        top20: share(buckets.top20, bucketTotal),
        beyond: share(buckets.beyond, bucketTotal),
      },
    },
    topQueries: queries.map(toRow),
    topPages: pages.map(toRow),
    movers: { gainers: toMover("gain"), losers: toMover("loss") },
    source: "stored",
  };
}

export const GscInsightsService = { getInsights };
