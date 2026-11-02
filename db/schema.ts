import {sqliteTable,text,integer,primaryKey,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const pagePreferences=sqliteTable('page_preferences',{
 workspaceId:text('workspace_id').primaryKey(),accountId:text('account_id').notNull(),updatedAt:text('updated_at').notNull()
});
export const scheduledJobs=sqliteTable('scheduled_jobs',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),postId:text('post_id').notNull(),accountId:text('account_id').notNull(),postVersion:integer('post_version').notNull(),scheduledAt:text('scheduled_at').notNull(),status:text('status').notNull(),revision:integer('revision').notNull().default(1),error:text('error'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('one_job_per_page').on(t.workspaceId,t.postId,t.accountId)]);
export const notices=sqliteTable('notices',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),kind:text('kind').notNull(),title:text('title').notNull(),message:text('message').notNull(),entityId:text('entity_id').notNull(),read:integer('read').notNull().default(0),createdAt:text('created_at').notNull()
});
export const accountProfiles=sqliteTable('account_profiles',{
 accountId:text('account_id').primaryKey(),workspaceId:text('workspace_id').notNull(),picture:text('picture').notNull().default(''),updatedAt:text('updated_at').notNull()
});
export const publishing=sqliteTable('publishing',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),postId:text('post_id').notNull(),accountId:text('account_id').notNull(),postVersion:integer('post_version').notNull(),status:text('status').notNull(),remoteId:text('remote_id'),error:text('error'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('one_post_per_page').on(t.workspaceId,t.postId,t.accountId)]);
export const accountActivity=sqliteTable('account_activity',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),event:text('event').notNull(),entityId:text('entity_id').notNull(),label:text('label').notNull(),createdAt:text('created_at').notNull()
});
export const socialApps=sqliteTable('social_apps',{
 provider:text('provider').primaryKey(),clientId:text('client_id').notNull(),secret:text('secret').notNull(),apiVersion:text('api_version').notNull(),updatedAt:text('updated_at').notNull()
});
export const socialStates=sqliteTable('social_states',{
 hash:text('hash').primaryKey(),workspaceId:text('workspace_id').notNull(),provider:text('provider').notNull(),verifier:text('verifier').notNull(),expiresAt:integer('expires_at').notNull()
});
export const socialAccounts=sqliteTable('social_accounts',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),provider:text('provider').notNull(),remoteId:text('remote_id').notNull(),name:text('name').notNull(),token:text('token').notNull(),expiresAt:integer('expires_at'),scopes:text('scopes').notNull(),status:text('status').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('social_remote_owner').on(t.workspaceId,t.provider,t.remoteId)]);
export const appAdmins=sqliteTable('app_admins',{
 slot:text('slot').primaryKey(),userId:text('user_id').notNull(),seeded:integer('seeded').notNull().default(0),createdAt:text('created_at').notNull()
});
export const postHistory=sqliteTable('post_history',{
 workspaceId:text('workspace_id').notNull(),postId:text('post_id').notNull(),version:integer('version').notNull(),document:text('document').notNull(),deleted:integer('deleted').notNull(),savedAt:text('saved_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.postId,t.version]})]);
export const workspaces=sqliteTable('workspaces',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),name:text('name').notNull(),createdAt:text('created_at').notNull()
},t=>[uniqueIndex('workspaces_owner').on(t.ownerId)]);
export const posts=sqliteTable('posts',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id),id:text('id').notNull(),document:text('document').notNull(),version:integer('version').notNull(),deleted:integer('deleted').notNull().default(0),updatedAt:text('updated_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.id]})]);
export const media=sqliteTable('media',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id),id:text('id').notNull(),name:text('name').notNull(),type:text('type').notNull(),size:integer('size').notNull(),objectKey:text('object_key').notNull(),metadata:text('metadata').notNull(),createdAt:text('created_at').notNull(),deleted:integer('deleted').notNull().default(0)
},t=>[primaryKey({columns:[t.workspaceId,t.id]})]);
