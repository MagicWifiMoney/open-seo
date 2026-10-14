CREATE TABLE "rank_competitor_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"tracking_keyword_id" text NOT NULL,
	"device" text NOT NULL,
	"competitor_domain" text NOT NULL,
	"position" integer,
	"url" text,
	"checked_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rank_tracking_configs" ADD COLUMN "track_competitors" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rank_competitor_snapshots" ADD CONSTRAINT "rank_competitor_snapshots_run_id_rank_check_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."rank_check_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rank_competitor_snapshots_run_keyword_device_domain_idx" ON "rank_competitor_snapshots" USING btree ("run_id","tracking_keyword_id","device","competitor_domain");