import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";

// Daily Google Search Console and GA4 rows kept so history survives the
// providers' own retention windows. All dates are YYYY-MM-DD.

const base = () => ({
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  fetchedAt: text("fetched_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

const gscMetrics = () => ({
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: real("ctr").notNull().default(0),
  position: real("position").notNull().default(0),
  // True once Google's data for the day is final (no longer fresh).
  finalized: integer("finalized", { mode: "boolean" }).notNull().default(false),
});

// device '' means all devices.
export const gscDailySite = sqliteTable(
  "gsc_daily_site",
  {
    ...base(),
    device: text("device").notNull().default(""),
    ...gscMetrics(),
  },
  (table) => [
    uniqueIndex("gsc_daily_site_unique_idx").on(
      table.projectId,
      table.date,
      table.device,
    ),
  ],
);

export const gscDailyPage = sqliteTable(
  "gsc_daily_page",
  {
    ...base(),
    page: text("page").notNull(),
    ...gscMetrics(),
  },
  (table) => [
    uniqueIndex("gsc_daily_page_unique_idx").on(
      table.projectId,
      table.date,
      table.page,
    ),
  ],
);

export const gscDailyQueryPage = sqliteTable(
  "gsc_daily_query_page",
  {
    ...base(),
    query: text("query").notNull(),
    page: text("page").notNull(),
    device: text("device").notNull(),
    ...gscMetrics(),
  },
  (table) => [
    uniqueIndex("gsc_daily_query_page_unique_idx").on(
      table.projectId,
      table.date,
      table.query,
      table.page,
      table.device,
    ),
    index("gsc_daily_query_page_project_date_idx").on(
      table.projectId,
      table.date,
    ),
  ],
);

export const ga4DailyTotal = sqliteTable(
  "ga4_daily_total",
  {
    ...base(),
    sessions: integer("sessions").notNull().default(0),
    activeUsers: integer("active_users").notNull().default(0),
    engagedSessions: integer("engaged_sessions").notNull().default(0),
    keyEvents: integer("key_events").notNull().default(0),
  },
  (table) => [
    uniqueIndex("ga4_daily_total_unique_idx").on(table.projectId, table.date),
  ],
);

export const ga4DailyChannel = sqliteTable(
  "ga4_daily_channel",
  {
    ...base(),
    channelGroup: text("channel_group").notNull(),
    sessions: integer("sessions").notNull().default(0),
    activeUsers: integer("active_users").notNull().default(0),
    engagedSessions: integer("engaged_sessions").notNull().default(0),
    keyEvents: integer("key_events").notNull().default(0),
  },
  (table) => [
    uniqueIndex("ga4_daily_channel_unique_idx").on(
      table.projectId,
      table.date,
      table.channelGroup,
    ),
  ],
);

export const ga4DailyLandingPage = sqliteTable(
  "ga4_daily_landing_page",
  {
    ...base(),
    channelGroup: text("channel_group").notNull(),
    landingPage: text("landing_page").notNull(),
    sessions: integer("sessions").notNull().default(0),
    engagedSessions: integer("engaged_sessions").notNull().default(0),
    keyEvents: integer("key_events").notNull().default(0),
  },
  (table) => [
    uniqueIndex("ga4_daily_landing_page_unique_idx").on(
      table.projectId,
      table.date,
      table.channelGroup,
      table.landingPage,
    ),
  ],
);

export const ga4DailyKeyEvent = sqliteTable(
  "ga4_daily_key_event",
  {
    ...base(),
    channelGroup: text("channel_group").notNull(),
    eventName: text("event_name").notNull(),
    keyEvents: integer("key_events").notNull().default(0),
    totalUsers: integer("total_users").notNull().default(0),
  },
  (table) => [
    uniqueIndex("ga4_daily_key_event_unique_idx").on(
      table.projectId,
      table.date,
      table.channelGroup,
      table.eventName,
    ),
  ],
);

// One row per project and source: backfill progress plus the run claim.
export const metricsIngestState = sqliteTable(
  "metrics_ingest_state",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["gsc", "ga4"] }).notNull(),
    backfillCursorDate: text("backfill_cursor_date"),
    backfillDone: integer("backfill_done", { mode: "boolean" })
      .notNull()
      .default(false),
    lastRunAt: text("last_run_at"),
    lastSuccessAt: text("last_success_at"),
    lastError: text("last_error"),
    claimedAt: text("claimed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("metrics_ingest_state_unique_idx").on(
      table.projectId,
      table.source,
    ),
  ],
);
