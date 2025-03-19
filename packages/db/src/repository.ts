import { eq, and, lt, gt, or, desc } from 'drizzle-orm'
import { getDrizzle } from './connection'
import { users, User, NewUser } from './schema/users'
import {
  prNotifications,
  PrNotification,
  NewPrNotification,
} from './schema/pr-notifications'

/**
 * Repository for database operations
 */
export class Repository {
  /**
   * Find all users
   */
  static async findAllUsers(): Promise<User[]> {
    const db = getDrizzle()
    return db.select().from(users)
  }

  /**
   * Find a user by ID
   */
  static async findUserById(id: number): Promise<User | undefined> {
    const db = getDrizzle()
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    return result[0]
  }

  /**
   * Find a user by email
   */
  static async findUserByEmail(email: string): Promise<User | undefined> {
    const db = getDrizzle()
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    return result[0]
  }

  /**
   * Create a new user
   */
  static async createUser(newUser: NewUser): Promise<User> {
    const db = getDrizzle()
    const result = await db.insert(users).values(newUser).returning()
    if (!result[0]) {
      throw new Error('Failed to create user')
    }
    return result[0]
  }

  /**
   * Update a user
   */
  static async updateUser(
    id: number,
    userData: Partial<NewUser>,
  ): Promise<User | undefined> {
    const db = getDrizzle()
    const result = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    return result[0]
  }

  /**
   * Delete a user
   */
  static async deleteUser(id: number): Promise<boolean> {
    const db = getDrizzle()
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id })
    return result.length > 0
  }

  /**
   * Find all PR notifications
   */
  static async findAllPrNotifications(): Promise<PrNotification[]> {
    const db = getDrizzle()
    return db
      .select()
      .from(prNotifications)
      .orderBy(desc(prNotifications.createdAt))
  }

  /**
   * Find PR notifications by repository
   */
  static async findPrNotificationsByRepo(
    repository: string,
  ): Promise<PrNotification[]> {
    const db = getDrizzle()
    return db
      .select()
      .from(prNotifications)
      .where(eq(prNotifications.repository, repository))
      .orderBy(desc(prNotifications.createdAt))
  }

  /**
   * Find if a PR has been notified
   */
  static async isPrNotified(
    repository: string,
    prNumber: number,
  ): Promise<boolean> {
    const db = getDrizzle()
    const result = await db
      .select()
      .from(prNotifications)
      .where(
        and(
          eq(prNotifications.repository, repository),
          eq(prNotifications.prNumber, prNumber),
          eq(prNotifications.isNotified, true),
        ),
      )
      .limit(1)
    return result.length > 0
  }

  /**
   * Find PR notifications by run ID
   */
  static async findPrNotificationsByRunId(
    runId: string,
  ): Promise<PrNotification[]> {
    const db = getDrizzle()
    return db
      .select()
      .from(prNotifications)
      .where(eq(prNotifications.runId, runId))
      .orderBy(desc(prNotifications.createdAt))
  }

  /**
   * Create a new PR notification
   */
  static async createPrNotification(
    newNotification: NewPrNotification,
  ): Promise<PrNotification> {
    const db = getDrizzle()
    const result = await db
      .insert(prNotifications)
      .values(newNotification)
      .returning()
    if (!result[0]) {
      throw new Error('Failed to create PR notification')
    }
    return result[0]
  }

  /**
   * Update a PR notification
   */
  static async updatePrNotification(
    id: number,
    notificationData: Partial<NewPrNotification>,
  ): Promise<PrNotification | undefined> {
    const db = getDrizzle()
    const result = await db
      .update(prNotifications)
      .set({ ...notificationData, updatedAt: new Date() })
      .where(eq(prNotifications.id, id))
      .returning()
    return result[0]
  }

  /**
   * Mark a PR as notified
   */
  static async markPrAsNotified(
    repository: string,
    prNumber: number,
    runId: string,
  ): Promise<boolean> {
    const db = getDrizzle()
    const result = await db
      .update(prNotifications)
      .set({ isNotified: true, updatedAt: new Date() })
      .where(
        and(
          eq(prNotifications.repository, repository),
          eq(prNotifications.prNumber, prNumber),
          eq(prNotifications.runId, runId),
        ),
      )
      .returning({ id: prNotifications.id })
    return result.length > 0
  }
}
