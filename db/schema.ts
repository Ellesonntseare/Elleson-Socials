import {sqliteTable,text,integer,primaryKey,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),name:text('name').notNull(),createdAt:text('created_at').notNull()
},t=>[uniqueIndex('workspaces_owner').on(t.ownerId)]);
export const posts=sqliteTable('posts',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id),id:text('id').notNull(),document:text('document').notNull(),version:integer('version').notNull(),deleted:integer('deleted').notNull().default(0),updatedAt:text('updated_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.id]})]);
export const media=sqliteTable('media',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id),id:text('id').notNull(),name:text('name').notNull(),type:text('type').notNull(),size:integer('size').notNull(),objectKey:text('object_key').notNull(),metadata:text('metadata').notNull(),createdAt:text('created_at').notNull(),deleted:integer('deleted').notNull().default(0)
},t=>[primaryKey({columns:[t.workspaceId,t.id]})]);
