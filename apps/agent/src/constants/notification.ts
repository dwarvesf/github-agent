export const NOTIFICATION_CONFIG = {
  initialInterval: 30 * 60 * 1000, // 30 minutes
  multiplier: 2, // Exponential growth factor
  maxInterval: 4 * 60 * 60 * 1000, // 4 hours (cap)
}

/**
 * Configuration for timed notification jobs
 */
interface NotificationConfig {
  /** Unique identifier for the notification */
  id: number

  /** Name of the workflow to execute */
  workflowName: string

  /** Optional timing configuration */
  timing?: {
    second?: number | string
    minute?: number | string
    hour?: number | string
    dayOfMonth?: number | string
    month?: number | string
    dayOfWeek?: number | string
  }

  /**
   * Timezone for when the cron job should run
   */
  timezone?: string

  /**
   * Optional array of inactive sub-jobs
   * This can be used to disable specific sub-jobs of the main job.
   */
  inactiveSubJobs?: string[]

  /** Optional cron expression (alternative to timing) */
  expression?: string

  /** Whether this notification is currently active */
  isActive: boolean
}

// TODO: Use a database to store notification configurations
export const DEFAULT_NOTIFICATION_CONFIGS: NotificationConfig[] = [
  {
    id: 1,
    workflowName: 'sendTodayPRListToDiscordWorkflow',
    timing: {
      minute: 0,
      hour: 17,
      dayOfWeek: '1-5',
    },
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  },
  {
    id: 2,
    workflowName: 'notifyDeveloperAboutPRStatus',
    timing: {
      minute: '*/30', // Notify every 30 minutes
      hour: '8-17', // Notify from 8 AM to 5 PM
      dayOfWeek: 'MON-FRI', // Monday to Friday
    },
    // inactiveSubJobs: ['handleApprovedNotMerged'],
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  },
  {
    id: 3,
    workflowName: 'notifyInactivePRsWorkflow',
    timing: {
      minute: 30,
      hour: 8,
      dayOfWeek: '1-5',
    },
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  },
  {
    id: 4,
    workflowName: 'notifyReviewersWorkflow',
    timing: {
      minute: '*/30',
      hour: '8-17',
      dayOfWeek: '1-5',
    },
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  },
]
