import { eq, and, lt, gt, desc, SQL, InferInsertModel, sql } from 'drizzle-orm'
import { getDrizzle } from './connection'
import {
  events,
  EventType,
  EventData,
  EventMetadata,
  EventCategory,
  EventPriority,
} from './schema'

export type InsertEvent = InferInsertModel<typeof events>

/**
 * Repository for database operations
 */
export class Repository {
  /**
   * Log an event in the system with enhanced fields
   */
  static async logEvent(
    eventCategory: EventCategory,
    eventType: EventType,
    organizationId: string,
    eventData: EventData,
    options?: {
      metadata?: EventMetadata
      actorId?: string
      repositoryId?: string
      workflowId?: string
      contextId?: string
      parentEventId?: string
      tags?: string[]
    },
  ): Promise<{ id: string }> {
    const db = getDrizzle()
    const {
      metadata,
      actorId,
      repositoryId,
      workflowId,
      contextId,
      parentEventId,
      tags,
    } = options || {}

    const results = await db
      .insert(events)
      .values({
        eventCategory,
        eventType,
        organizationId,
        eventData,
        metadata,
        actorId,
        repositoryId,
        workflowId,
        contextId,
        parentEventId,
        tags,
        createdAt: new Date(),
      })
      .returning({ id: events.id })

    // Ensure we have results
    if (results.length === 0) {
      throw new Error('Failed to insert event')
    }

    // TypeScript non-null assertion for the first result
    return results[0]!
  }

  /**
   * Get all events for an organization with enhanced filtering and pagination
   */
  static async getEvents(
    organizationId: string,
    options?: {
      eventCategories?: EventCategory[]
      eventTypes?: EventType[]
      fromDate?: Date
      toDate?: Date
      repositoryId?: string
      actorId?: string
      workflowId?: string
      contextId?: string
      tags?: string[]
      limit?: number
      offset?: number
    },
  ) {
    const db = getDrizzle()
    const {
      eventCategories,
      eventTypes,
      fromDate,
      toDate,
      repositoryId,
      actorId,
      workflowId,
      contextId,
      tags,
      limit = 100,
      offset = 0,
    } = options || {}

    const whereConditions: SQL<unknown>[] = [
      eq(events.organizationId, organizationId),
    ]

    if (eventCategories && eventCategories.length > 0) {
      whereConditions.push(
        sql`${events.eventCategory} IN (${eventCategories.join(',')})`,
      )
    }

    if (eventTypes && eventTypes.length > 0) {
      whereConditions.push(
        sql`${events.eventType} IN (${eventTypes.join(',')})`,
      )
    }

    if (fromDate) {
      whereConditions.push(gt(events.createdAt, fromDate))
    }

    if (toDate) {
      whereConditions.push(lt(events.createdAt, toDate))
    }

    if (repositoryId) {
      whereConditions.push(eq(events.repositoryId, repositoryId))
    }

    if (actorId) {
      whereConditions.push(eq(events.actorId, actorId))
    }

    if (workflowId) {
      whereConditions.push(eq(events.workflowId, workflowId))
    }

    if (contextId) {
      whereConditions.push(eq(events.contextId, contextId))
    }

    if (tags && tags.length > 0) {
      // Search for events that contain ANY of the provided tags
      // This uses PostgreSQL's array containment operators
      const tagsArray = JSON.stringify(tags)
      whereConditions.push(sql`${events.tags} ?| ${tagsArray}::jsonb`)
    }

    const result = await db
      .select()
      .from(events)
      .where(and(...whereConditions))
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset)

    return result
  }
}
