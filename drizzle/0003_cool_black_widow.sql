CREATE TABLE `account_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event` text NOT NULL,
	`entity_id` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER posts_activity_insert AFTER INSERT ON posts BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), NEW.workspace_id, 'post.created', NEW.id, 'Post created', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER posts_activity_update AFTER UPDATE ON posts BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), NEW.workspace_id, CASE WHEN NEW.deleted = 1 THEN 'post.deleted' ELSE 'post.saved' END, NEW.id, CASE WHEN NEW.deleted = 1 THEN 'Post deleted' ELSE 'Post saved' END, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER media_activity_insert AFTER INSERT ON media BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), NEW.workspace_id, 'file.added', NEW.id, 'File added', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER media_activity_update AFTER UPDATE ON media WHEN NEW.deleted <> OLD.deleted BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), NEW.workspace_id, CASE WHEN NEW.deleted = 1 THEN 'file.removed' ELSE 'file.restored' END, NEW.id, CASE WHEN NEW.deleted = 1 THEN 'File removed' ELSE 'File restored' END, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER social_activity_insert AFTER INSERT ON social_accounts BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), NEW.workspace_id, 'account.connected', NEW.id, 'Account connected', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER social_activity_update AFTER UPDATE ON social_accounts BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), NEW.workspace_id, 'account.checked', NEW.id, 'Account checked', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER social_activity_delete AFTER DELETE ON social_accounts BEGIN
 INSERT INTO account_activity VALUES (lower(hex(randomblob(16))), OLD.workspace_id, 'account.disconnected', OLD.id, 'Account disconnected', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
