import { PullRequest } from '../lib/type'
import type { Event, EventCategory, EventType } from '.'
import type { Prisma } from './.generated' // Import Prisma types
import { getPrisma } from './connection'

export enum NotificationType {
  WAITING_FOR_REVIEW = 'waiting_for_review',
  MERGE_CONFLICTS = 'merge_conflicts',
  PR_PENDING_MERGE = 'pr_pending_merge',
  WRONG_CONVENTION = 'wrong_convention',
  DAILY_REPORT = 'daily_report',
  REVIEWER_REMINDER = 'reviewer_reminder',
}

export type PRList = Partial<
  PullRequest & {
    number: number
    title: string
    author: string
    createdAt?: string
    updatedAt?: string
    mergedAt?: string | null
    url?: string
    [key: string]: any
  }
>
// Types for event data
export type EventData = {
  message?: string
  userId?: string
  reviewer?: string
  notificationType?: NotificationType
  discordChannelId?: string
  discordUserId?: string
  repositoriesPRs?: Array<{
    repositoryId: string
    prList: Array<PRList>
  }>
  prList?: Array<PRList>
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
 * Options for filtering events.
 * Excludes pagination options like limit/offset.
 */
type EventFilterOptions = {
  organizationId?: string
  eventCategories?: EventCategory[]
  eventTypes?: EventType[]
  fromDate?: Date
  toDate?: Date
  repositoryId?: string
  actorId?: string
  workflowId?: string
  contextId?: string
  tags?: string[]
  eventData?: EventData
}

/**
 * Repository for database operations using Prisma
 */
export class EventRepository {
  /**
   * Log an event in the system with enhanced fields.
   * Returns the newly created event.
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
  }): Promise<{ id: string }> {
    const prisma = getPrisma()

    return prisma.event.create({
      data: {
        ...event,
      },
      select: {
        id: true,
      },
    })
  }

  /**
   * Build the where conditions for event queries based on filter options.
   * @param options - Filtering criteria.
   * @returns A Prisma where input object.
   */
  private static _buildWhereConditions(
    options?: EventFilterOptions,
  ): Prisma.EventWhereInput {
    const {
      organizationId,
      eventCategories,
      eventTypes,
      fromDate,
      toDate,
      repositoryId,
      actorId,
      workflowId,
      contextId,
      tags,
      eventData,
    } = options || {}

    // Use Prisma.EventWhereInput for type safety
    const whereConditions: Prisma.EventWhereInput = {
      organizationId, // Required
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

    if (fromDate || toDate) {
      whereConditions.createdAt = {}
      if (fromDate) {
        whereConditions.createdAt.gte = fromDate // Use gte for inclusive start
      }
      if (toDate) {
        whereConditions.createdAt.lt = toDate // lt remains exclusive end
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
        hasEvery: tags,
      }
    }

    // Add event data filtering using Prisma JSON filtering
    if (eventData && Object.keys(eventData).length > 0) {
      const jsonFilters = Object.entries(eventData).map(([key, value]) => ({
        eventData: {
          path: [key],
          equals: value,
        },
      }))

      if (!whereConditions.AND) {
        whereConditions.AND = []
      }
      if (Array.isArray(whereConditions.AND)) {
        whereConditions.AND.push(...jsonFilters)
      } else {
        whereConditions.AND = [whereConditions.AND, ...jsonFilters]
      }

      delete (whereConditions as any).eventData
    }

    return whereConditions
  }

  /**
   * Get events matching criteria with pagination.
   */
  static async getEvents(
    organizationId: string,
    options?: Omit<EventFilterOptions, 'organizationId'> & {
      limit?: number
      offset?: number
    },
  ): Promise<Event[]> {
    const prisma = getPrisma()
    const { limit = 100, offset = 0, ...filterOptions } = options || {}

    const whereConditions = this._buildWhereConditions({
      organizationId,
      ...filterOptions,
    })

    return prisma.event.findMany({
      where: whereConditions,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })
  }

  /**
   * Find the most recent event matching the given criteria.
   */
  static async findLastEvent(
    options: EventFilterOptions,
  ): Promise<Event | null> {
    const prisma = getPrisma()
    const whereConditions = this._buildWhereConditions(options)

    return prisma.event.findFirst({
      where: whereConditions,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  /**
   * Grouping organizations
   */
  public static getOrganizationsString(
    repos: NonNullable<EventData['repositoriesPRs']>,
  ) {
    return repos
      .flatMap((repo) => repo.prList.map((pr) => pr.organizationId))
      .filter(Boolean)
      .reduce((acc, org) => {
        if (org && !acc.includes(org)) {
          acc.push(org.trim())
        }
        return acc
      }, [] as string[])
      .sort()
      .join(', ')
  }
}
