// Shared by the GSC Insights server function and page (no server imports).

export const GSC_INSIGHTS_RANGES = ["28d", "3m", "6m", "12m", "16m"] as const;
export const GSC_INSIGHTS_COMPARES = [
  "previous_period",
  "year_over_year",
  "none",
] as const;
export const GSC_INSIGHTS_DEVICES = [
  "all",
  "desktop",
  "mobile",
  "tablet",
] as const;

export type GscInsightsRange = (typeof GSC_INSIGHTS_RANGES)[number];
export type GscInsightsCompare = (typeof GSC_INSIGHTS_COMPARES)[number];
export type GscInsightsDevice = (typeof GSC_INSIGHTS_DEVICES)[number];

export type DateWindow = { start: string; end: string };

export type InsightsDelta = {
  absolute: number;
  /** Percent change against the compare value; null when it was zero. */
  percent: number | null;
};

export type InsightsMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export type InsightsDailyRow = InsightsMetrics & { date: string };
export type InsightsTotals = InsightsMetrics;
export type InsightsTotalsWithDelta = {
  clicks: InsightsDelta;
  impressions: InsightsDelta;
  ctr: InsightsDelta;
  /** Raw difference; lower position is better, so the UI inverts the colour. */
  position: InsightsDelta;
};

export type InsightsRow = {
  /** The query text or the page URL. */
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosition: number;
  clicksDelta: number;
  impressionsDelta: number;
  /** Positive means the ranking got worse (higher number). null if no prior. */
  positionDelta: number | null;
};

export type GscInsights =
  | { coverage: null }
  | {
      coverage: {
        start: string;
        end: string;
        finalizedThrough: string | null;
      };
      window: DateWindow;
      compareWindow: DateWindow | null;
      daily: InsightsDailyRow[];
      compareDaily: InsightsDailyRow[];
      totals: InsightsTotals;
      compareTotals: InsightsTotals | null;
      deltas: InsightsTotalsWithDelta | null;
      deviceSplit: {
        device: string;
        clicks: number;
        impressions: number;
        clicksShare: number;
        impressionsShare: number;
      }[];
      positionBuckets: {
        top3: number;
        top10: number;
        top20: number;
        beyond: number;
        total: number;
        shares: { top3: number; top10: number; top20: number; beyond: number };
      };
      topQueries: InsightsRow[];
      topPages: InsightsRow[];
      movers: { gainers: InsightsRow[]; losers: InsightsRow[] };
      source: "stored";
    };
