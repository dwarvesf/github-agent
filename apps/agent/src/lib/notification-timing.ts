import { NOTIFICATION_CONFIG } from '../constants/notification'
import { Event } from '../db'

interface NotificationEventMetadata {
  notifiedTimes: string[]
  [key: string]: unknown
}

export type NotificationEvent = Omit<Event, 'metadata'> & {
  metadata: NotificationEventMetadata
}

/**
 * Service for managing notification timing and intervals
 */
export class NotificationTimingService {
  /**
   * Calculate the required notification interval using exponential backoff
   * @param notificationCount Number of previous notifications
   * @param config Optional configuration to override defaults
   * @returns Required interval in milliseconds
   */
  static calculateInterval(
    notificationCount: number,
    config: Partial<typeof NOTIFICATION_CONFIG> = {},
  ): number {
    const { initialInterval, multiplier, maxInterval } = {
      ...NOTIFICATION_CONFIG,
      ...config,
    }

    // For the first notification, use the initial interval
    if (notificationCount <= 1) {
      return initialInterval
    }

    // Calculate exponential backoff: initialInterval * multiplier^(notificationCount-1)
    const exponentialInterval =
      initialInterval * Math.pow(multiplier, notificationCount - 1)

    // Cap at maxInterval
    return Math.min(exponentialInterval, maxInterval)
  }

  /**
   * Check if enough time has passed since the last notification
   * @param lastNotificationTime Timestamp of the last notification
   * @param requiredInterval Required interval in milliseconds
   * @returns Whether enough time has passed
   */
  static shouldNotify(
    lastNotificationTime: number,
    requiredInterval: number,
  ): boolean {
    return Date.now() - lastNotificationTime >= requiredInterval
  }

  /**
   * Check if a notification should be sent based on history and timing rules
   * @param lastEvent The last notification event, if any
   * @returns Object containing whether to notify and the last notification time
   */
  static checkNotificationHistory(
    notifiedTimes: string[] = [],
    config: Partial<typeof NOTIFICATION_CONFIG> = {},
  ): {
    shouldNotify: boolean
    lastNotificationTime: string | undefined
    notifiedTimes: string[]
  } {
    const lastNotificationTime = Math.max(
      ...notifiedTimes.map((time) => new Date(time).getTime()),
      0,
    )
    const requiredInterval = this.calculateInterval(
      notifiedTimes.length,
      config,
    )
    const shouldNotify =
      !lastNotificationTime ||
      this.shouldNotify(lastNotificationTime, requiredInterval)

    return {
      shouldNotify,
      notifiedTimes,
      lastNotificationTime: lastNotificationTime
        ? new Date(lastNotificationTime).toISOString()
        : undefined,
    }
  }
}
