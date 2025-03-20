import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
  text,
  foreignKey,
} from 'drizzle-orm/pg-core'

/**
 * Repositories table - Minimal representation for reference
 */
export const repositories = pgTable('repositories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  url: varchar('url', { length: 255 }).notNull(),
  organizationId: uuid('organization_id').notNull(),
})

/**
 * Events table - Tracks all system events
 * Enhanced with proper relations, context tracking, and additional fields
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Event classification
    eventCategory: varchar('event_category', { length: 100 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),

    // Foreign key relations
    actorId: varchar('actor_id', { length: 255 }),
    repositoryId: varchar('repository_id', { length: 255 }),
    workflowId: varchar('workflow_id', { length: 255 }),
    // The github Organization/Repository relationship
    organizationId: varchar('organization_id', { length: 255 }).notNull(),

    // Event data
    eventData: jsonb('event_data').notNull(),
    metadata: jsonb('metadata'),

    // Context tracking
    contextId: varchar('context_id', { length: 255 }), // Groups related events
    parentEventId: varchar('parent_event_id', { length: 255 }), // For hierarchical events

    // Tagging and classification
    tags: jsonb('tags').$type<string[]>(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at'),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => {
    return {
      eventCategoryIdx: index('event_category_idx').on(table.eventCategory),
      eventTypeIdx: index('event_type_idx').on(table.eventType),
      createdAtIdx: index('created_at_idx').on(table.createdAt),
      organizationIdIdx: index('organization_id_idx').on(table.organizationId),
      contextIdIdx: index('context_id_idx').on(table.contextId),
      tagsIdx: index('tags_idx').on(table.tags), // Index on JSON array for performance
    }
  },
)

// Self-reference for parent-child relationships between events
// This enables tracking of event hierarchies
foreignKey({
  columns: [events.parentEventId],
  foreignColumns: [events.id],
  name: 'events_parent_event_id_fkey',
})

// Event categories for hierarchical classification
export enum EventCategory {
  NOTIFICATION_DISCORD = 'NOTIFICATION_DISCORD',
  NOTIFICATION_SLACK = 'NOTIFICATION_SLACK',
  NOTIFICATION_EMAIL = 'NOTIFICATION_EMAIL',
  ACTIVITY = 'ACTIVITY',
  ERROR = 'ERROR',
}

// Event types enum - expanded with more specific types
export enum EventType {
  // Notification events
  REMINDER_SENT = 'REMINDER_SENT',
  PR_NOTIFIED = 'PR_NOTIFIED',
  COMMENT_NOTIFIED = 'COMMENT_NOTIFIED',
  MENTION_NOTIFIED = 'MENTION_NOTIFIED',

  // Activity events
  PR_CREATED = 'PR_CREATED',
  PR_UPDATED = 'PR_UPDATED',
  PR_REVIEWED = 'PR_REVIEWED',
  PR_MERGED = 'PR_MERGED',
  PR_CLOSED = 'PR_CLOSED',
  PR_STALLED = 'PR_STALLED',

  // System events
  SYSTEM_STARTED = 'SYSTEM_STARTED',
  SYSTEM_STOPPED = 'SYSTEM_STOPPED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIG_CHANGED = 'CONFIG_CHANGED',

  // Security events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',

  // User actions
  USER_ACTION = 'USER_ACTION',
}

// Event priority levels
export enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Types for event data
export type EventData = {
  message?: string
  details?: Record<string, any>
  prNumber?: number
  repoName?: string
  userId?: string
  [key: string]: any
}

export type EventMetadata = {
  source?: string
  ipAddress?: string
  userAgent?: string
  version?: string
  [key: string]: any
}
