CREATE TABLE `push_deliveries` (
	`subscription_id` text NOT NULL,
	`notice_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`subscription_id`, `notice_id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`subscription` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
