CREATE TABLE "offsite_authority_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"snapshot_date" text NOT NULL,
	"referring_domains" integer,
	"backlinks" integer,
	"source" text DEFAULT 'dataforseo_backlinks' NOT NULL,
	"checked_at" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offsite_outreach_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"target_name" text NOT NULL,
	"target_url" text,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"asked_on" text,
	"linked_page_url" text,
	"note" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offsite_authority_snapshots" ADD CONSTRAINT "offsite_authority_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offsite_authority_snapshots" ADD CONSTRAINT "offsite_authority_snapshots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offsite_outreach_log" ADD CONSTRAINT "offsite_outreach_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offsite_outreach_log" ADD CONSTRAINT "offsite_outreach_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offsite_snapshots_project_date_idx" ON "offsite_authority_snapshots" USING btree ("project_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "offsite_outreach_project_idx" ON "offsite_outreach_log" USING btree ("project_id");