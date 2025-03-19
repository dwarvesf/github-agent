import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
} from 'drizzle-orm/pg-core'

/**
 * PR Notifications table schema
 * Tracks pull requests that have been notified to developers
 */
export const prNotifications = pgTable('pr_notifications', {
  id: serial('id').primaryKey(),
  prNumber: integer('pr_number').notNull(),
  prTitle: text('pr_title').notNull(),
  prUrl: text('pr_url').notNull(),
  repository: varchar('repository', { length: 255 }).notNull(),
  authorUsername: varchar('author_username', { length: 100 }).notNull(),
  discordUserId: varchar('discord_user_id', { length: 100 }),
  isNotified: boolean('is_notified').notNull().default(false),
  runId: varchar('run_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * PR Notification type based on the schema
 */
export type PrNotification = typeof prNotifications.$inferSelect
export type NewPrNotification = typeof prNotifications.$inferInsert
