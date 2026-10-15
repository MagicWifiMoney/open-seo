import { z } from "zod";
import { SITE_LAUNCH_DATE, isValidIsoDate } from "@/types/schemas/traffic";

export const OVERVIEW_RANGES = [
  "last_28_days",
  "last_90_days",
  "last_6_months",
  "last_12_months",
  "since_launch",
  "pre_launch",
  "custom",
] as const;

export const OVERVIEW_COMPARES = [
  "previous_period",
  "last_year",
  "six_months_ago",
  "pre_launch_avg",
] as const;

export const OVERVIEW_DEVICES = ["desktop", "mobile"] as const;
export const OVERVIEW_PAGE_TABS = ["top", "new"] as const;

export type OverviewRange = (typeof OVERVIEW_RANGES)[number];
export type OverviewCompare = (typeof OVERVIEW_COMPARES)[number];
export type OverviewDevice = (typeof OVERVIEW_DEVICES)[number];
export type OverviewPageTab = (typeof OVERVIEW_PAGE_TABS)[number];

const isoDate = z.string().refine(isValidIsoDate);

/** /p/$projectId query params for the Overview. Bad values fall back to the
 *  default. The range and compare params are the shared control: any tab can
 *  read the same names. */
export const overviewSearchSchema = z.object({
  range: z.enum(OVERVIEW_RANGES).default("since_launch").catch("since_launch"),
  compare: z
    .enum(OVERVIEW_COMPARES)
    .default("pre_launch_avg")
    .catch("pre_launch_avg"),
  launch: isoDate.default(SITE_LAUNCH_DATE).catch(SITE_LAUNCH_DATE),
  // Launch marker toggle on the trend chart.
  marker: z.boolean().default(true).catch(true),
  // Only used when range is "custom".
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  // Rank tracker config; absent means the tracker with the most keywords.
  tracker: z.string().optional().catch(undefined),
  device: z.enum(OVERVIEW_DEVICES).default("desktop").catch("desktop"),
  pages: z.enum(OVERVIEW_PAGE_TABS).default("top").catch("top"),
});

export type OverviewSearch = z.infer<typeof overviewSearchSchema>;

export const OVERVIEW_SEARCH_DEFAULTS = {
  range: "since_launch",
  compare: "pre_launch_avg",
  launch: SITE_LAUNCH_DATE,
  marker: true,
  device: "desktop",
  pages: "top",
} as const;

const span = z.object({ start: isoDate, end: isoDate });

/** Input of the Overview Search Console report. Windows are chosen on the
 *  client (see overviewRange.ts); the server only reads them. */
export const overviewSearchReportInputSchema = z.object({
  projectId: z.string().min(1),
  current: span,
  compare: span.nullable(),
  /** Pages with impressions in this window count as "seen before launch". */
  preLaunch: span.nullable(),
});
