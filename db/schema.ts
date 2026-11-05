import {sqliteTable, text, integer, primaryKey} from 'drizzle-orm/sqlite-core';

export const progress = sqliteTable('progress', {
  userId: text('user_id').primaryKey(),
  revision: integer('revision').notNull(),
  state: text('state').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const progressBackups = sqliteTable('progress_backups', {
  userId: text('user_id').notNull(),
  revision: integer('revision').notNull(),
  state: text('state').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [primaryKey({columns: [t.userId, t.revision]})]);
