CREATE TABLE `cost_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`occurred_at` text NOT NULL,
	`source` text NOT NULL,
	`run_id` text,
	`run_kind` text,
	`provider` text NOT NULL,
	`credit_feature` text,
	`api_path` text,
	`operation` text NOT NULL,
	`request_summary` text,
	`result_count` integer,
	`cost_usd` real NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cost_ledger_project_time_idx` ON `cost_ledger` (`project_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `cost_ledger_run_idx` ON `cost_ledger` (`run_id`);