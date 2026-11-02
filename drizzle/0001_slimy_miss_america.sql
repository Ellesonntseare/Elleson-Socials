CREATE TABLE `app_admins` (
	`slot` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`seeded` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `post_history` (
	`workspace_id` text NOT NULL,
	`post_id` text NOT NULL,
	`version` integer NOT NULL,
	`document` text NOT NULL,
	`deleted` integer NOT NULL,
	`saved_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `post_id`, `version`)
);
-- Keep before-and-after snapshots in the same database transaction as each edit.
--> statement-breakpoint
CREATE TRIGGER posts_history_insert AFTER INSERT ON posts BEGIN
 INSERT OR IGNORE INTO post_history (workspace_id, post_id, version, document, deleted, saved_at)
 VALUES (NEW.workspace_id, NEW.id, NEW.version, NEW.document, NEW.deleted, NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER posts_history_update AFTER UPDATE ON posts BEGIN
 INSERT OR IGNORE INTO post_history (workspace_id, post_id, version, document, deleted, saved_at)
 VALUES (OLD.workspace_id, OLD.id, OLD.version, OLD.document, OLD.deleted, OLD.updated_at);
 INSERT OR IGNORE INTO post_history (workspace_id, post_id, version, document, deleted, saved_at)
 VALUES (NEW.workspace_id, NEW.id, NEW.version, NEW.document, NEW.deleted, NEW.updated_at);
END;
