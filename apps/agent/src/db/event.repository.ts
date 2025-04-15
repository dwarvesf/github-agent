import type { EventType, EventCategory, Event } from '.'
import { getPrisma } from './connection'

export enum NotificationType {
  WAITING_FOR_REVIEW = 'waiting_for_review',
  MERGE_CONFLICTS = 'merge_conflicts',
  PR_PENDING_MERGE = 'pr_pending_merge',
  WRONG_CONVENTION = 'wrong_convention',
  DAILY_REPORT = 'daily_report',
}

// Types for event data
export type EventData = {
  message?: string
  userId?: string
  notificationType?: NotificationType
  discordChannelId?: string
  discordUserId?: string
  prList?: {
    number: number
    title: string
    author: string
    createdAt?: string
    updatedAt?: string
    mergedAt?: string | null
    url?: string
    [key: string]: any
  }[]
  commitList?: {
    message: string
    url: string
    author: string
    sha: string
    hash?: string
    createdAt?: string
  }[]
  repository?: {
    name: string
    url?: string
  }
  details?: Record<string, any>
}

export type EventMetadata = {
  error?: string
  llmLogs?: string
  source?: string
  ipAddress?: string
  userAgent?: string
  version?: string
  [key: string]: any
}

/**
 * Repository for database operations using Prisma
 */
export class EventRepository {
  /**
   * Log an event in the system with enhanced fields
   */
  static async logEvent(event: {
    eventCategory: EventCategory
    eventType: EventType
    organizationId: string
    eventData: EventData
    metadata?: EventMetadata
    workflowId?: string
    contextId?: string
    actorId?: string
    repositoryId?: string
    parentEventId?: string
    tags?: string[]
    createdAt?: Date
    updatedAt?: Date
    resolvedAt?: Date
  }): Promise<Event> {
    const prisma = getPrisma()

    const result = await prisma.event.create({
      data: {
        ...event,
      },
      select: {
        id: true,
      },
    })

    return result as any
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
    const prisma = getPrisma()
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

    // Build where conditions
    const whereConditions: any = {
      organizationId,
    }

    if (eventCategories && eventCategories.length > 0) {
      whereConditions.eventCategory = {
        in: eventCategories,
      }
    }

    if (eventTypes && eventTypes.length > 0) {
      whereConditions.eventType = {
        in: eventTypes,
      }
    }

    if (fromDate) {
      whereConditions.createdAt = {
        ...whereConditions.createdAt,
        gt: fromDate,
      }
    }

    if (toDate) {
      whereConditions.createdAt = {
        ...whereConditions.createdAt,
        lt: toDate,
      }
    }

    if (repositoryId) {
      whereConditions.repositoryId = repositoryId
    }

    if (actorId) {
      whereConditions.actorId = actorId
    }

    if (workflowId) {
      whereConditions.workflowId = workflowId
    }

    if (contextId) {
      whereConditions.contextId = contextId
    }

    if (tags && tags.length > 0) {
      whereConditions.tags = {
        hasSome: tags,
      }
    }

    return prisma.event.findMany({
      where: whereConditions,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })
  }
}
