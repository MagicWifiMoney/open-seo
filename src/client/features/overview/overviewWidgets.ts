import {
  formatNumber,
  formatPercent,
} from "@/client/features/traffic/trafficFormat";
import type { DateSpan, DayPoint } from "@/client/features/traffic/trafficMath";
import type { Kpi, KpiKey } from "./overviewMetrics";
import type { NewPagesSummary, RankSummary } from "./overviewSentences";

/** Counts below this show a plain change, not a percentage. */
const SMALL_BASE = 10;
/** A sparkline needs at least this many points to say anything. */
const MIN_SERIES_POINTS = 3;
const MAX_SERIES_POINTS = 30;

export type Tone = "good" | "bad" | "neutral";

type DeltaChip = {
  arrow: "up" | "down" | "flat";
  text: string;
  tone: Tone;
};

function toneOf(kpi: Kpi): Tone {
  return kpi.better === true
    ? "good"
    : kpi.better === false
      ? "bad"
      : "neutral";
}

/** Arrow (direction of the number) plus percent or places. Null when the
 *  comparison cannot be read, so the card shows its note instead. */
export function deltaChip(kpi: Kpi): DeltaChip | null {
  if (kpi.current === null || kpi.base === null || kpi.absolute === null) {
    return null;
  }
  if (kpi.trend === null) return null;
  if (kpi.trend === "flat") {
    return { arrow: "flat", text: "About the same", tone: "neutral" };
  }
  const arrow = kpi.trend;
  const tone = toneOf(kpi);
  if (kpi.key === "position") {
    return {
      arrow,
      text: `${Math.abs(kpi.absolute).toFixed(1)} places`,
      tone,
    };
  }
  if (kpi.percent === null || kpi.base < SMALL_BASE) {
    return {
      arrow,
      text: `${formatNumber(Math.abs(kpi.absolute))} ${arrow === "up" ? "more" : "fewer"}`,
      tone,
    };
  }
  return {
    arrow,
    text: formatPercent(Math.abs(kpi.percent)).replace("+", ""),
    tone,
  };
}

/** Daily values of one GA4 metric across a window, summed into at most
 *  MAX_SERIES_POINTS equal runs of days. Null when the window is not covered or has too few days
 *  to draw: no series is invented. */
export function gaSeries(
  days: DayPoint[],
  span: DateSpan,
  key: "sessions" | "keyEvents",
  coverage: DateSpan,
): number[] | null {
  if (span.start < coverage.start || span.end > coverage.end) return null;
  const inside = days.filter((d) => d.date >= span.start && d.date <= span.end);
  if (inside.length < MIN_SERIES_POINTS) return null;
  const size = Math.ceil(inside.length / MAX_SERIES_POINTS);
  const points: number[] = [];
  for (let i = 0; i < inside.length; i += size) {
    let sum = 0;
    for (const day of inside.slice(i, i + size)) sum += day[key];
    points.push(sum);
  }
  return points.length >= MIN_SERIES_POINTS ? points : null;
}

/** SVG polyline points for a series, scaled to width x height with a pad. */
export function sparklinePoints(
  series: number[],
  width: number,
  height: number,
  pad = 2,
): string {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min;
  const stepX = (width - pad * 2) / (series.length - 1);
  return series
    .map((value, i) => {
      const x = pad + i * stepX;
      const y =
        range === 0
          ? height / 2
          : height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export type StatTile = {
  key: string;
  value: string;
  label: string;
  context: string;
  tone: Tone;
};

function clicksTile(
  kpi: Kpi,
  currentLabel: string,
  compareLabel: string,
): StatTile | null {
  const chip = deltaChip(kpi);
  if (!chip || kpi.current === null || kpi.base === null) return null;
  const sign = chip.arrow === "up" ? "+" : chip.arrow === "down" ? "-" : "";
  const value =
    chip.arrow === "flat"
      ? "Flat"
      : kpi.percent !== null && kpi.base >= SMALL_BASE
        ? `${sign}${formatPercent(Math.abs(kpi.percent)).replace("+", "")}`
        : `${sign}${formatNumber(Math.abs(kpi.absolute ?? 0))}`;
  return {
    key: "clicks",
    value,
    label: "Clicks vs baseline",
    context: `${formatNumber(kpi.current)} in ${currentLabel} vs ${formatNumber(kpi.base)} in ${compareLabel}. Google Search Console.`,
    tone: chip.tone,
  };
}

function positionTile(
  kpi: Kpi,
  currentLabel: string,
  compareLabel: string,
): StatTile | null {
  const chip = deltaChip(kpi);
  if (!chip || kpi.current === null || kpi.base === null) return null;
  const places = Math.abs(kpi.absolute ?? 0).toFixed(1);
  const label =
    chip.arrow === "flat"
      ? "Avg position, unchanged"
      : chip.arrow === "down"
        ? "Places closer to top"
        : "Places further from top";
  return {
    key: "position",
    value: chip.arrow === "flat" ? kpi.current.toFixed(1) : places,
    label,
    context: `${kpi.current.toFixed(1)} in ${currentLabel} vs ${kpi.base.toFixed(1)} in ${compareLabel}. Lower is better. Google Search Console.`,
    tone: chip.tone,
  };
}

function rankTile(summary: RankSummary): StatTile {
  const coverage = `checked ${summary.checked} of ${summary.total} keywords`;
  const partial =
    summary.checked < summary.total
      ? " Some keywords unchecked and not counted as not ranking, so it may undercount."
      : "";
  const was =
    summary.topTenBefore !== null && summary.previousLabel !== null
      ? ` Was ${summary.topTenBefore} on ${summary.previousLabel}.`
      : " No earlier complete run.";
  const tone: Tone =
    summary.topTenBefore === null || summary.topTenBefore === summary.topTenNow
      ? "neutral"
      : summary.topTenNow > summary.topTenBefore
        ? "good"
        : "bad";
  return {
    key: "topTen",
    value: formatNumber(summary.topTenNow),
    label: "Keywords in top 10",
    context: `Rank tracker, ${summary.device}, ${coverage}, ${summary.latestLabel}.${was}${partial}`,
    tone,
  };
}

function newPagesTile(
  summary: NewPagesSummary,
  currentLabel: string,
): StatTile {
  const caveat = summary.maybeIncomplete
    ? " Row limit reached, may be low."
    : "";
  return {
    key: "newPages",
    value: formatNumber(summary.count),
    label: "Pages newly shown",
    context: `Impressions in ${currentLabel}, none in ${summary.lookbackLabel}. Google Search Console.${caveat}`,
    tone: "neutral",
  };
}

/** Compact tiles that replace the old "What changed" bullets. Each one still
 *  carries the window or the "checked X of Y" coverage its sentence had. */
export function buildStatTiles(input: {
  currentLabel: string;
  compareLabel: string;
  kpis: Partial<Record<KpiKey, Kpi>>;
  rankings: RankSummary | null;
  newPages: NewPagesSummary | null;
}): StatTile[] {
  const { currentLabel, compareLabel, kpis } = input;
  const tiles: Array<StatTile | null> = [
    input.rankings ? rankTile(input.rankings) : null,
    input.newPages ? newPagesTile(input.newPages, currentLabel) : null,
    kpis.clicks ? clicksTile(kpis.clicks, currentLabel, compareLabel) : null,
    kpis.position
      ? positionTile(kpis.position, currentLabel, compareLabel)
      : null,
  ];
  return tiles.filter((tile): tile is StatTile => tile !== null);
}
