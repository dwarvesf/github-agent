import { Event } from '../db'

export interface NotificationEventData {
  notificationType: string
  message: string
  prList: Array<{
    number: number
    title: string
    url: string
    author: string
  }>
  reviewer: string
  details: {
    embed: {
      title: string
      color: number
      description: string
      inline: boolean
    }
    notificationType: string
    reviewRequestAge: string
  }
  [key: string]: unknown
}

export type NotificationEvent = Omit<Event, 'eventData' | 'metadata'> & {
  eventData: NotificationEventData
}

/**
 * Service for managing notification timing and intervals
 */
export class NotificationTimingService {
  /**
   * Default configuration for notification intervals
   */
  private static readonly DEFAULT_CONFIG = {
    intervalIncrement: 30 * 60 * 1000, // 30 minutes
    maxInterval: 4 * 60 * 60 * 1000, // 4 hours
  }

  /**
   * Calculate the required notification interval based on notification count
   * @param notificationCount Number of previous notifications
   * @param config Optional configuration to override defaults
   * @returns Required interval in milliseconds
   */
  static calculateInterval(
    notificationCount: number,
    config: Partial<typeof NotificationTimingService.DEFAULT_CONFIG> = {},
  ): number {
    const { intervalIncrement, maxInterval } = {
      ...NotificationTimingService.DEFAULT_CONFIG,
      ...config,
    }

    return Math.min(notificationCount * intervalIncrement, maxInterval)
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
  static checkNotificationHistory(lastEvent: Event | undefined | null): {
    shouldNotify: boolean
    lastNotificationTime: string | undefined
  } {
    const notifiedTimes =
      (lastEvent?.metadata as { notifiedTimes?: string[] })?.notifiedTimes || []
    const lastNotificationTime =
      lastEvent?.createdAt && new Date(lastEvent.createdAt).toISOString()
    const requiredInterval = this.calculateInterval(notifiedTimes.length)
    const shouldNotify =
      !lastNotificationTime ||
      this.shouldNotify(
        new Date(lastNotificationTime).getTime(),
        requiredInterval,
      )

    return {
      shouldNotify,
      lastNotificationTime,
    }
  }
}
