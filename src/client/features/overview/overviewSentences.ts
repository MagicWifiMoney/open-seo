import {
  formatNumber,
  KEY_EVENTS_NOT_COMPARABLE,
} from "@/client/features/traffic/trafficFormat";
import type { Kpi, KpiKey } from "./overviewMetrics";

/** Counts below this are described in plain numbers, not percentages: "up 300%"
 *  from 1 to 4 overstates what the data shows. */
const SMALL_BASE = 10;
const MAX_SENTENCES = 5;

export type RankSummary = {
  device: string;
  total: number;
  checked: number;
  latestLabel: string;
  topTenNow: number;
  /** Null when there is no earlier complete run to compare with. */
  topTenBefore: number | null;
  previousLabel: string | null;
};

export type NewPagesSummary = {
  count: number;
  lookbackLabel: string;
  /** True when the Search Console row limit may have cut the lists short. */
  maybeIncomplete: boolean;
};

export type SentenceInput = {
  /** Printed window of the chosen range, e.g. "Sep 17 to Oct 12, 2026". */
  currentLabel: string;
  /** Printed window of the reference, including any rescaling note. */
  compareLabel: string;
  /** Only the KPIs whose source is connected and readable. */
  kpis: Partial<Record<KpiKey, Kpi>>;
  rankings: RankSummary | null;
  newPages: NewPagesSummary | null;
  /** True when either window is not entirely after launch, so key events
   *  (a different event before launch) must not be compared. */
  keyEventsNotComparable?: boolean;
};

const COUNT_SUBJECT: Record<Exclude<KpiKey, "position">, string> = {
  clicks: "Clicks from Google Search",
  impressions: "Google Search impressions",
  sessions: "Organic search visits to the site",
  keyEvents: "Key events from organic search visits",
};

function describeCount(
  key: Exclude<KpiKey, "position">,
  kpi: Kpi,
  input: SentenceInput,
): string | null {
  if (kpi.current === null || kpi.base === null || kpi.absolute === null) {
    return null;
  }
  const subject = COUNT_SUBJECT[key];
  const now = formatNumber(kpi.current);
  const before = formatNumber(kpi.base);
  const windows = `${now} in ${input.currentLabel} against ${before} in ${input.compareLabel}`;
  if (kpi.current === 0 && kpi.base === 0) {
    return `${subject} were zero in both ${input.currentLabel} and ${input.compareLabel}.`;
  }
  if (kpi.trend === "flat") {
    return `${subject} were about the same: ${windows}.`;
  }
  const direction = kpi.trend === "up" ? "up" : "down";
  if (kpi.percent === null || kpi.base < SMALL_BASE) {
    return `${subject} were ${direction}: ${windows}. The starting number is small, so no percentage is shown.`;
  }
  return `${subject} were ${direction} ${Math.abs(Math.round(kpi.percent))}%: ${windows}.`;
}

function describeKeyEvents(kpi: Kpi, input: SentenceInput): string | null {
  if (!input.keyEventsNotComparable)
    return describeCount("keyEvents", kpi, input);
  if (kpi.current === null) return null;
  return `Key events from organic search visits were ${formatNumber(kpi.current)} in ${input.currentLabel}. ${KEY_EVENTS_NOT_COMPARABLE}`;
}

function describePosition(kpi: Kpi, input: SentenceInput): string | null {
  if (kpi.current === null || kpi.base === null || kpi.absolute === null) {
    return null;
  }
  const now = kpi.current.toFixed(1);
  const before = kpi.base.toFixed(1);
  const windows = `${now} in ${input.currentLabel} against ${before} in ${input.compareLabel}`;
  if (kpi.trend === "flat") {
    return `Average position in Google Search was about the same: ${windows}. Lower is better.`;
  }
  const places = Math.abs(kpi.absolute).toFixed(1);
  const side = kpi.trend === "down" ? "closer to" : "further from";
  return `Average position in Google Search was ${places} places ${side} the top of the results: ${windows}. Lower is better.`;
}

function describeRankings(summary: RankSummary): string {
  const where = `Rank tracker (organic positions, ${summary.device}, checked ${summary.checked} of ${summary.total} keywords)`;
  const partial =
    summary.checked < summary.total
      ? " Some keywords have no check yet and are not counted as not ranking, so counts can undercount."
      : "";
  if (summary.topTenBefore === null || summary.previousLabel === null) {
    return `${where}: ${summary.topTenNow} keywords were in the top 10 by the newest check of each keyword, latest ${summary.latestLabel}. There is no earlier complete run to compare with.${partial}`;
  }
  return `${where}: ${summary.topTenNow} keywords were in the top 10 by the newest check of each keyword, latest ${summary.latestLabel}, against ${summary.topTenBefore} in the previous complete run on ${summary.previousLabel}.${partial}`;
}

function describeNewPages(summary: NewPagesSummary, input: SentenceInput) {
  const caveat = summary.maybeIncomplete
    ? " Search Console returned its row limit, so this count may be low."
    : "";
  if (summary.count === 0) {
    return `No pages got Search Console impressions in ${input.currentLabel} that had none in ${summary.lookbackLabel}.${caveat}`;
  }
  const noun = summary.count === 1 ? "page" : "pages";
  return `${formatNumber(summary.count)} ${noun} got Search Console impressions in ${input.currentLabel} that had none in ${summary.lookbackLabel}.${caveat}`;
}

/** Three to five plain sentences about what moved, from the numbers alone.
 *  Deterministic: no model call, no claim about why. */
export function buildWhatChanged(input: SentenceInput): string[] {
  const { kpis } = input;
  const candidates: Array<string | null> = [
    kpis.clicks ? describeCount("clicks", kpis.clicks, input) : null,
    kpis.keyEvents ? describeKeyEvents(kpis.keyEvents, input) : null,
    kpis.position ? describePosition(kpis.position, input) : null,
    input.rankings ? describeRankings(input.rankings) : null,
    input.newPages ? describeNewPages(input.newPages, input) : null,
    kpis.sessions ? describeCount("sessions", kpis.sessions, input) : null,
    kpis.impressions
      ? describeCount("impressions", kpis.impressions, input)
      : null,
  ];
  return candidates
    .filter((sentence): sentence is string => sentence !== null)
    .slice(0, MAX_SENTENCES);
}
