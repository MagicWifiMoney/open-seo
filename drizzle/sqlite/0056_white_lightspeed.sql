CREATE TABLE `rank_competitor_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`tracking_keyword_id` text NOT NULL,
	`device` text NOT NULL,
	`competitor_domain` text NOT NULL,
	`position` integer,
	`url` text,
	`checked_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `rank_check_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rank_competitor_snapshots_run_keyword_device_domain_idx` ON `rank_competitor_snapshots` (`run_id`,`tracking_keyword_id`,`device`,`competitor_domain`);--> statement-breakpoint
ALTER TABLE `rank_tracking_configs` ADD `track_competitors` integer DEFAULT false NOT NULL;