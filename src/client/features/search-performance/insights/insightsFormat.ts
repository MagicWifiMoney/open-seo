import { buildCsv } from "@/client/lib/csv";
import type {
  GscInsightsCompare,
  GscInsightsDevice,
  GscInsightsRange,
  InsightsDailyRow,
  InsightsDelta,
} from "@/types/schemas/gsc-insights";

export const RANGE_LABELS: Record<GscInsightsRange, string> = {
  "28d": "28 days",
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
  "16m": "16 months",
};
export const COMPARE_LABELS: Record<GscInsightsCompare, string> = {
  previous_period: "Previous period",
  year_over_year: "Year over year",
  none: "No comparison",
};
export const DEVICE_LABELS: Record<GscInsightsDevice, string> = {
  all: "All devices",
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

export type DeltaKind = "count" | "ctr" | "position";
export type DeltaTone = "good" | "bad" | "neutral";

export const formatInt = (value: number) =>
  Math.round(value).toLocaleString("en-US");
export const formatCtr = (value: number) => `${(value * 100).toFixed(1)}%`;
export const formatPosition = (value: number) =>
  value > 0 ? value.toFixed(1) : "-";

/** Plain-text date (YYYY-MM-DD) as "Mar 1, 2026" without a timezone shift. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function signed(value: number, text: string): string {
  if (value > 0) return `+${text}`;
  return value < 0 ? `-${text}` : text;
}

/**
 * How a delta reads on screen. Clicks, impressions and CTR are good when they
 * rise. Position is a rank, so a LOWER number is better: a negative position
 * delta is green and a positive one is red.
 */
export function describeDelta(
  kind: DeltaKind,
  delta: InsightsDelta | null,
): { text: string; tone: DeltaTone } {
  if (!delta) return { text: "", tone: "neutral" };
  const { absolute, percent } = delta;
  if (kind === "position") {
    const rounded = Math.round(absolute * 10) / 10;
    const text = signed(rounded, Math.abs(rounded).toFixed(1));
    if (rounded === 0) return { text, tone: "neutral" };
    return { text, tone: rounded < 0 ? "good" : "bad" };
  }
  const flat = Math.abs(absolute) < (kind === "ctr" ? 0.0005 : 0.5);
  if (kind === "ctr") {
    const points = Math.round(absolute * 1000) / 10;
    return {
      text: `${signed(points, Math.abs(points).toFixed(1))} pts`,
      tone: flat ? "neutral" : absolute > 0 ? "good" : "bad",
    };
  }
  const text =
    percent === null
      ? signed(absolute, formatInt(Math.abs(absolute)))
      : `${signed(percent, Math.abs(percent).toFixed(1))}%`;
  return { text, tone: flat ? "neutral" : absolute > 0 ? "good" : "bad" };
}

export const toneClass: Record<DeltaTone, string> = {
  good: "text-success",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

// ---- Trend chart series ----

export type ChartGranularity = "day" | "week";
export type ChartPoint = {
  date: string;
  compareDate: string | null;
  clicks: number;
  impressions: number;
  prevClicks: number | null;
  prevImpressions: number | null;
};

/** Weekly buckets once the window is longer than three months. */
export function granularityFor(days: number): ChartGranularity {
  return days > 92 ? "week" : "day";
}

function rolling(values: number[], size: number): number[] {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - size + 1), index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function weekly(rows: InsightsDailyRow[]) {
  const out: { date: string; clicks: number; impressions: number }[] = [];
  for (let i = 0; i < rows.length; i += 7) {
    const chunk = rows.slice(i, i + 7);
    out.push({
      date: chunk[0].date,
      clicks: chunk.reduce((sum, row) => sum + row.clicks, 0),
      impressions: chunk.reduce((sum, row) => sum + row.impressions, 0),
    });
  }
  return out;
}

/**
 * Lines the compare window up with the current one by day index (or by week
 * index), so a point's ghost value is the same relative day of the prior
 * period. The 7-day rolling average only applies to the daily view.
 */
export function buildChartPoints(
  daily: InsightsDailyRow[],
  compareDaily: InsightsDailyRow[],
  options: { granularity: ChartGranularity; rolling: boolean },
): ChartPoint[] {
  const shape = (rows: InsightsDailyRow[]) => {
    const base =
      options.granularity === "week"
        ? weekly(rows)
        : rows.map(({ date, clicks, impressions }) => ({
            date,
            clicks,
            impressions,
          }));
    if (options.granularity !== "day" || !options.rolling) return base;
    const clicks = rolling(
      base.map((row) => row.clicks),
      7,
    );
    const impressions = rolling(
      base.map((row) => row.impressions),
      7,
    );
    return base.map((row, i) => ({
      date: row.date,
      clicks: clicks[i],
      impressions: impressions[i],
    }));
  };
  const current = shape(daily);
  const compare = shape(compareDaily);
  return current.map((row, i) => ({
    date: row.date,
    compareDate: compare[i]?.date ?? null,
    clicks: row.clicks,
    impressions: row.impressions,
    prevClicks: compare[i]?.clicks ?? null,
    prevImpressions: compare[i]?.impressions ?? null,
  }));
}

/** Client-side CSV of the daily series, with the compare day on each row. */
export function dailyCsv(
  daily: InsightsDailyRow[],
  compareDaily: InsightsDailyRow[],
): string {
  return buildCsv(
    [
      "Date",
      "Clicks",
      "Impressions",
      "CTR (%)",
      "Position",
      "Compare date",
      "Compare clicks",
      "Compare impressions",
      "Compare CTR (%)",
      "Compare position",
    ],
    daily.map((row, i) => {
      const prev = compareDaily[i];
      return [
        row.date,
        row.clicks,
        row.impressions,
        Math.round(row.ctr * 10_000) / 100,
        Math.round(row.position * 10) / 10,
        prev?.date,
        prev?.clicks,
        prev?.impressions,
        prev ? Math.round(prev.ctr * 10_000) / 100 : undefined,
        prev ? Math.round(prev.position * 10) / 10 : undefined,
      ];
    }),
  );
}
