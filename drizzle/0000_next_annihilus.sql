CREATE TABLE `media` (
	`workspace_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`workspace_id`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`workspace_id` text NOT NULL,
	`id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_owner` ON `workspaces` (`owner_id`);