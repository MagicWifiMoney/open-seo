import { z } from "zod";

/** Site launch date (the new site went live this day). Single source of truth
 *  for the Traffic history tab; the `launch` URL param defaults to it. */
export const SITE_LAUNCH_DATE = "2026-08-15";

export const TRAFFIC_RANGES = [
  "last_28_days",
  "last_90_days",
  "last_12_months",
  "since_launch",
  "pre_launch",
  "all",
  "custom",
] as const;
export const TRAFFIC_METRICS = ["sessions", "users", "key_events"] as const;
export const TRAFFIC_GRANULARITIES = ["day", "week", "month"] as const;
export const TRAFFIC_COMPARES = ["baseline", "yoy"] as const;

/** Channel views. `all` is every channel, the rest map to a GA4 default
 *  channel group (see TRAFFIC_CHANNEL_GROUP_NAMES). */
export const TRAFFIC_CHANNELS = [
  "all",
  "organic_search",
  "direct",
  "referral",
  "paid_search",
  "organic_social",
  "email",
] as const;

export const TRAFFIC_CHANNEL_GROUP_NAMES: Record<
  Exclude<TrafficChannel, "all">,
  string
> = {
  organic_search: "Organic Search",
  direct: "Direct",
  referral: "Referral",
  paid_search: "Paid Search",
  organic_social: "Organic Social",
  email: "Email",
};

export type TrafficRange = (typeof TRAFFIC_RANGES)[number];
export type TrafficMetric = (typeof TRAFFIC_METRICS)[number];
export type TrafficGranularity = (typeof TRAFFIC_GRANULARITIES)[number];
export type TrafficCompare = (typeof TRAFFIC_COMPARES)[number];
export type TrafficChannel = (typeof TRAFFIC_CHANNELS)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

const isoDate = z.string().refine(isValidIsoDate);

/** /p/$projectId/traffic query params. Bad values fall back to the default. */
export const trafficSearchSchema = z.object({
  range: z.enum(TRAFFIC_RANGES).default("all").catch("all"),
  metric: z.enum(TRAFFIC_METRICS).default("sessions").catch("sessions"),
  channel: z.enum(TRAFFIC_CHANNELS).default("all").catch("all"),
  granularity: z.enum(TRAFFIC_GRANULARITIES).default("week").catch("week"),
  compare: z.enum(TRAFFIC_COMPARES).default("baseline").catch("baseline"),
  launch: isoDate.default(SITE_LAUNCH_DATE).catch(SITE_LAUNCH_DATE),
  // Only used when range is "custom".
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export type TrafficSearch = z.infer<typeof trafficSearchSchema>;

export const TRAFFIC_SEARCH_DEFAULTS = {
  range: "all",
  metric: "sessions",
  channel: "all",
  granularity: "week",
  compare: "baseline",
  launch: SITE_LAUNCH_DATE,
} as const;

/** Input of the history server function. The date range is chosen on the
 *  client from one cached full-history fetch, so only project and channel
 *  go to the server. */
export const trafficHistoryInputSchema = z.object({
  projectId: z.string().min(1),
  channel: z.enum(TRAFFIC_CHANNELS).default("all"),
});
