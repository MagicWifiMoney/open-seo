CREATE TABLE `offsite_authority_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`referring_domains` integer,
	`backlinks` integer,
	`source` text DEFAULT 'dataforseo_backlinks' NOT NULL,
	`checked_at` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offsite_snapshots_project_date_idx` ON `offsite_authority_snapshots` (`project_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `offsite_outreach_log` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`target_name` text NOT NULL,
	`target_url` text,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`asked_on` text,
	`linked_page_url` text,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `offsite_outreach_project_idx` ON `offsite_outreach_log` (`project_id`);