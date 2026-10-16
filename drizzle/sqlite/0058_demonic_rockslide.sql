CREATE TABLE `ga4_daily_channel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`channel_group` text NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`active_users` integer DEFAULT 0 NOT NULL,
	`engaged_sessions` integer DEFAULT 0 NOT NULL,
	`key_events` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ga4_daily_channel_unique_idx` ON `ga4_daily_channel` (`project_id`,`date`,`channel_group`);--> statement-breakpoint
CREATE TABLE `ga4_daily_key_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`channel_group` text NOT NULL,
	`event_name` text NOT NULL,
	`key_events` integer DEFAULT 0 NOT NULL,
	`total_users` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ga4_daily_key_event_unique_idx` ON `ga4_daily_key_event` (`project_id`,`date`,`channel_group`,`event_name`);--> statement-breakpoint
CREATE TABLE `ga4_daily_landing_page` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`channel_group` text NOT NULL,
	`landing_page` text NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`engaged_sessions` integer DEFAULT 0 NOT NULL,
	`key_events` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ga4_daily_landing_page_unique_idx` ON `ga4_daily_landing_page` (`project_id`,`date`,`channel_group`,`landing_page`);--> statement-breakpoint
CREATE TABLE `ga4_daily_total` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`active_users` integer DEFAULT 0 NOT NULL,
	`engaged_sessions` integer DEFAULT 0 NOT NULL,
	`key_events` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ga4_daily_total_unique_idx` ON `ga4_daily_total` (`project_id`,`date`);--> statement-breakpoint
CREATE TABLE `gsc_daily_page` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`page` text NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`ctr` real DEFAULT 0 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`finalized` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gsc_daily_page_unique_idx` ON `gsc_daily_page` (`project_id`,`date`,`page`);--> statement-breakpoint
CREATE TABLE `gsc_daily_query_page` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`query` text NOT NULL,
	`page` text NOT NULL,
	`device` text NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`ctr` real DEFAULT 0 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`finalized` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gsc_daily_query_page_unique_idx` ON `gsc_daily_query_page` (`project_id`,`date`,`query`,`page`,`device`);--> statement-breakpoint
CREATE INDEX `gsc_daily_query_page_project_date_idx` ON `gsc_daily_query_page` (`project_id`,`date`);--> statement-breakpoint
CREATE TABLE `gsc_daily_site` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	`device` text DEFAULT '' NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`ctr` real DEFAULT 0 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`finalized` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gsc_daily_site_unique_idx` ON `gsc_daily_site` (`project_id`,`date`,`device`);--> statement-breakpoint
CREATE TABLE `metrics_ingest_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`source` text NOT NULL,
	`backfill_cursor_date` text,
	`backfill_done` integer DEFAULT false NOT NULL,
	`last_run_at` text,
	`last_success_at` text,
	`last_error` text,
	`claimed_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metrics_ingest_state_unique_idx` ON `metrics_ingest_state` (`project_id`,`source`);