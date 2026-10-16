CREATE TABLE "ga4_daily_channel" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"channel_group" text NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"engaged_sessions" integer DEFAULT 0 NOT NULL,
	"key_events" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ga4_daily_key_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"channel_group" text NOT NULL,
	"event_name" text NOT NULL,
	"key_events" integer DEFAULT 0 NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ga4_daily_landing_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"channel_group" text NOT NULL,
	"landing_page" text NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"engaged_sessions" integer DEFAULT 0 NOT NULL,
	"key_events" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ga4_daily_total" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"engaged_sessions" integer DEFAULT 0 NOT NULL,
	"key_events" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_daily_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"page" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"finalized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_daily_query_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"query" text NOT NULL,
	"page" text NOT NULL,
	"device" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"finalized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_daily_site" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"finalized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_ingest_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" text NOT NULL,
	"backfill_cursor_date" text,
	"backfill_done" boolean DEFAULT false NOT NULL,
	"last_run_at" text,
	"last_success_at" text,
	"last_error" text,
	"claimed_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ga4_daily_channel" ADD CONSTRAINT "ga4_daily_channel_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga4_daily_key_event" ADD CONSTRAINT "ga4_daily_key_event_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga4_daily_landing_page" ADD CONSTRAINT "ga4_daily_landing_page_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga4_daily_total" ADD CONSTRAINT "ga4_daily_total_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_daily_page" ADD CONSTRAINT "gsc_daily_page_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_daily_query_page" ADD CONSTRAINT "gsc_daily_query_page_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_daily_site" ADD CONSTRAINT "gsc_daily_site_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_ingest_state" ADD CONSTRAINT "metrics_ingest_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ga4_daily_channel_unique_idx" ON "ga4_daily_channel" USING btree ("project_id","date","channel_group");--> statement-breakpoint
CREATE UNIQUE INDEX "ga4_daily_key_event_unique_idx" ON "ga4_daily_key_event" USING btree ("project_id","date","channel_group","event_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ga4_daily_landing_page_unique_idx" ON "ga4_daily_landing_page" USING btree ("project_id","date","channel_group","landing_page");--> statement-breakpoint
CREATE UNIQUE INDEX "ga4_daily_total_unique_idx" ON "ga4_daily_total" USING btree ("project_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_daily_page_unique_idx" ON "gsc_daily_page" USING btree ("project_id","date","page");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_daily_query_page_unique_idx" ON "gsc_daily_query_page" USING btree ("project_id","date","query","page","device");--> statement-breakpoint
CREATE INDEX "gsc_daily_query_page_project_date_idx" ON "gsc_daily_query_page" USING btree ("project_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_daily_site_unique_idx" ON "gsc_daily_site" USING btree ("project_id","date","device");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_ingest_state_unique_idx" ON "metrics_ingest_state" USING btree ("project_id","source");