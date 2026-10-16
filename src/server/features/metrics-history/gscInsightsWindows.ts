// Date-window math for the GSC Insights page. Pure, UTC, YYYY-MM-DD strings.

import type {
  DateWindow,
  GscInsightsCompare,
  GscInsightsRange,
} from "@/types/schemas/gsc-insights";

const DAY_MS = 86_400_000;

const toMs = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return fromMs(toMs(date) + days * DAY_MS);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toMs(end) - toMs(start)) / DAY_MS);
}

/** Calendar-month shift that clamps to the last day (Mar 31 - 1m = Feb 28). */
export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

const PRESET_MONTHS: Record<Exclude<GscInsightsRange, "28d">, number> = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
  "16m": 16,
};

/** The window always ends at stored coverage, never at today. */
export function resolveWindow(
  input: { range: GscInsightsRange; from?: string; to?: string },
  coverage: DateWindow,
): DateWindow {
  if (input.from && input.to) {
    const end = input.to < coverage.end ? input.to : coverage.end;
    const from = input.from < coverage.start ? coverage.start : input.from;
    const start = from > end ? end : from;
    return { start, end };
  }
  const end = coverage.end;
  const start =
    input.range === "28d"
      ? addDays(end, -27)
      : addDays(addMonths(end, -PRESET_MONTHS[input.range]), 1);
  return { start: start < coverage.start ? coverage.start : start, end };
}

export function resolveCompareWindow(
  window: DateWindow,
  compare: GscInsightsCompare,
): DateWindow | null {
  if (compare === "none") return null;
  if (compare === "year_over_year") {
    return {
      start: addMonths(window.start, -12),
      end: addMonths(window.end, -12),
    };
  }
  const length = daysBetween(window.start, window.end) + 1;
  return {
    start: addDays(window.start, -length),
    end: addDays(window.start, -1),
  };
}
