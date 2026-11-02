CREATE TABLE `social_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`remote_id` text NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer,
	`scopes` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_remote_owner` ON `social_accounts` (`workspace_id`,`provider`,`remote_id`);--> statement-breakpoint
CREATE TABLE `social_apps` (
	`provider` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`secret` text NOT NULL,
	`api_version` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL
);
