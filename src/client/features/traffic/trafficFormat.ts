import type {
  TrafficChannel,
  TrafficCompare,
  TrafficGranularity,
  TrafficMetric,
  TrafficRange,
} from "@/types/schemas/traffic";

export const RANGE_LABELS: Record<TrafficRange, string> = {
  last_28_days: "Last 28 days",
  last_90_days: "Last 90 days",
  last_12_months: "Last 12 months",
  since_launch: "Since launch",
  pre_launch: "Pre-launch only",
  launch_window: "12 weeks before launch to now",
  all: "All available",
  custom: "Custom range",
};

export const METRIC_LABELS: Record<TrafficMetric, string> = {
  sessions: "Sessions",
  users: "Users",
  key_events: "Key events",
};

export const CHANNEL_LABELS: Record<TrafficChannel, string> = {
  all: "All traffic",
  organic_search: "Organic search",
  direct: "Direct",
  referral: "Referral",
  paid_search: "Paid search",
  organic_social: "Organic social",
  email: "Email",
};

export const GRANULARITY_LABELS: Record<TrafficGranularity, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export const COMPARE_LABELS: Record<TrafficCompare, string> = {
  baseline: "vs pre-launch average",
  yoy: "vs same period last year",
};

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** One decimal for small averages so 0.4 key events a week is not shown as 0. */
export function formatAverage(value: number): string {
  return value < 10
    ? value.toLocaleString("en-US", { maximumFractionDigits: 1 })
    : formatNumber(value);
}

export function formatSigned(value: number): string {
  const text = formatAverage(Math.abs(value));
  if (value > 0) return `+${text}`;
  return value < 0 ? `-${text}` : text;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "n/a";
  const text = Math.abs(value).toFixed(1);
  if (value > 0) return `+${text}%`;
  return value < 0 ? `-${text}%` : `${text}%`;
}

/** Local-time construction: Date.parse("2026-08-01") is UTC midnight and would
 *  render as the previous day west of Greenwich. */
function localDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(date: string): string {
  return localDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBucketLabel(
  start: string,
  g: TrafficGranularity,
): string {
  if (g === "month") {
    return localDate(start).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
  const text = localDate(start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return g === "week" ? `Wk of ${text}` : text;
}

/** Top-of-page note that replaces the Key events card. */
export const KEY_EVENT_TRACKING_NOTE =
  "Key event tracking changed, so counts before and after launch are not comparable.";

/** Tooltip and table flag for the week that holds the launch date. */
export const LAUNCH_WEEK_NOTE =
  "Partly old site: this week holds days from before launch, so it is not a before or after reading.";

/** Shown wherever key events would otherwise be compared across the launch. */
export const KEY_EVENTS_NOT_COMPARABLE =
  "Tracking changed at launch, so earlier counts are not comparable.";
