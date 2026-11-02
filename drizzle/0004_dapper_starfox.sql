CREATE TABLE `publishing` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`post_id` text NOT NULL,
	`account_id` text NOT NULL,
	`post_version` integer NOT NULL,
	`status` text NOT NULL,
	`remote_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_post_per_page` ON `publishing` (`workspace_id`,`post_id`,`account_id`);