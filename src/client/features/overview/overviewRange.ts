import {
  addDays,
  daysBetween,
  type DateSpan,
} from "@/client/features/traffic/trafficMath";
import type { OverviewCompare, OverviewRange } from "@/types/schemas/overview";

/** Search Console trails by about three days; GA4 trails less. One shared end
 *  date keeps both sources on the same window. */
const DATA_LAG_DAYS = 3;
/** The pre-launch reference window: the 12 weeks before launch. */
const PRE_LAUNCH_WEEKS = 12;
/** Search Console keeps about 16 months; used for the "seen before launch"
 *  lookback. */
const PRE_LAUNCH_LOOKBACK_DAYS = 480;

export const RANGE_LABELS: Record<OverviewRange, string> = {
  last_28_days: "Last 28 days",
  last_90_days: "Last 90 days",
  last_6_months: "Last 6 months",
  last_12_months: "Last 12 months",
  since_launch: "Since launch",
  pre_launch: "Pre-launch (12 weeks)",
  custom: "Custom range",
};

export const COMPARE_LABELS: Record<OverviewCompare, string> = {
  previous_period: "Previous period",
  last_year: "Same period last year",
  six_months_ago: "Same period 6 months ago",
  pre_launch_avg: "Pre-launch weekly average",
};

/** Latest day both sources should have, given today's date (YYYY-MM-DD). */
export function latestDataDate(today: string): string {
  return addDays(today, -DATA_LAG_DAYS);
}

/** Subtract calendar months, clamping the day to the target month length. */
export function subtractMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The 12 weeks before launch, ending the day before it. */
export function preLaunchWindow(launch: string): DateSpan {
  return {
    start: addDays(launch, -PRE_LAUNCH_WEEKS * 7),
    end: addDays(launch, -1),
  };
}

/** Concrete dates for a range preset. Null when the range cannot exist yet
 *  (launch is after the latest data day) or a custom range is incomplete. */
export function resolveWindow(input: {
  range: OverviewRange;
  asOf: string;
  launch: string;
  from?: string;
  to?: string;
}): DateSpan | null {
  const { range, asOf, launch } = input;
  switch (range) {
    case "last_28_days":
      return { start: addDays(asOf, -27), end: asOf };
    case "last_90_days":
      return { start: addDays(asOf, -89), end: asOf };
    case "last_6_months":
      return { start: addDays(subtractMonths(asOf, 6), 1), end: asOf };
    case "last_12_months":
      return { start: addDays(subtractMonths(asOf, 12), 1), end: asOf };
    case "since_launch":
      return launch <= asOf ? { start: launch, end: asOf } : null;
    case "pre_launch":
      return preLaunchWindow(launch);
    case "custom": {
      if (!input.from || !input.to) return null;
      const [a, b] =
        input.from <= input.to
          ? [input.from, input.to]
          : [input.to, input.from];
      return { start: a, end: b > asOf ? asOf : b };
    }
  }
}

export type CompareWindow = DateSpan & {
  /** Multiplier for additive totals (clicks, sessions) so a reference window
   *  of a different length reads per the same number of days as the current
   *  window. 1 unless the reference is an average. */
  scale: number;
  /** True when the reference is a weekly average rescaled to the current
   *  window length. */
  isAverage: boolean;
};

/** The reference window for a compare option. Null when the current window is
 *  missing or the compare would be identical to it. */
export function resolveCompare(input: {
  compare: OverviewCompare;
  current: DateSpan;
  launch: string;
}): CompareWindow | null {
  const { compare, current, launch } = input;
  const length = daysBetween(current.start, current.end);
  switch (compare) {
    case "previous_period":
      return {
        start: addDays(current.start, -length),
        end: addDays(current.start, -1),
        scale: 1,
        isAverage: false,
      };
    case "last_year":
      // 52 weeks back keeps weekdays aligned.
      return {
        start: addDays(current.start, -364),
        end: addDays(current.end, -364),
        scale: 1,
        isAverage: false,
      };
    case "six_months_ago":
      return {
        start: subtractMonths(current.start, 6),
        end: subtractMonths(current.end, 6),
        scale: 1,
        isAverage: false,
      };
    case "pre_launch_avg": {
      const window = preLaunchWindow(launch);
      return {
        ...window,
        scale: length / daysBetween(window.start, window.end),
        isAverage: true,
      };
    }
  }
}

/** The "seen before launch" lookback used for the New since launch tab. */
export function lookbackWindow(launch: string): DateSpan {
  return {
    start: addDays(launch, -PRE_LAUNCH_LOOKBACK_DAYS),
    end: addDays(launch, -1),
  };
}
