import { Mastra } from '@mastra/core'
import { Workflow } from '@mastra/core/workflows'
import { Cron, CronPattern } from 'croner'
import { logger } from '../utils/logger'
import { DEFAULT_NOTIFICATION_CONFIGS } from '../constants/notification'

/** Custom error for notification configuration issues */
class NotificationConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotificationConfigError'
  }
}

type NotificationConfig = (typeof DEFAULT_NOTIFICATION_CONFIGS)[number]

/**
 * Cron Expression Format:
 * ┌──────────────── (optional) second (0 - 59)
 * │ ┌────────────── minute (0 - 59)
 * │ │ ┌──────────── hour (0 - 23)
 * │ │ │ ┌────────── day of month (1 - 31)
 * │ │ │ │ ┌──────── month (1 - 12, JAN-DEC)
 * │ │ │ │ │ ┌────── day of week (0 - 6, SUN-MON)
 * │ │ │ │ │ │       (0 to 6 are Sunday to Saturday; 7 is Sunday, the same as 0)
 * │ │ │ │ │ │
 * * * * * * *
 */
type CronExpression = string

/**
 * Manages scheduled jobs for executing workflows at specified intervals.
 *
 * The Scheduler class handles the creation, management, and execution of
 * recurring tasks based on cron expressions. It integrates with the Mastra
 * workflow system to execute workflows at scheduled times.
 *
 * @example
 * ```typescript
 * const scheduler = new Scheduler();
 * scheduler.init(mastraInstance);
 * scheduler.refreshJob('daily-notification');
 * // Later when shutting down
 * scheduler.terminate();
 * ```
 */
class Scheduler {
  private jobs: Map<number, Cron> = new Map()
  private mastraInstance: Mastra | null = null

  /**
   * Initializes the scheduler with a Mastra instance.
   *
   * @param mastra - The Mastra workflow system instance to be used for executing jobs
   */
  public init(mastra: Mastra): void {
    this.mastraInstance = mastra
    this.initializeJobScheduler()
  }

  /**
   * Converts timing object to a cron expression string
   *
   * @param timing - The timing configuration object
   * @returns A valid cron expression string
   * @throws NotificationConfigError if timing values are invalid
   */
  private timingToCronExpression(
    timing: NotificationConfig['timing'],
  ): CronExpression {
    const {
      second,
      minute = '*',
      hour = '*',
      dayOfMonth = '*',
      month = '*',
      dayOfWeek = '*',
    } = timing || {}

    const timingValues = [second, minute, hour, dayOfMonth, month, dayOfWeek]

    const isInvalidTiming = timingValues.every((value) => value === '*')

    if (isInvalidTiming) {
      throw new NotificationConfigError('Invalid timing values provided')
    }

    return timingValues
      .filter((i) => ['string', 'number'].includes(typeof i))
      .join(' ')
  }

  /**
   * Validates and transforms notification config into a cron expression
   *
   * @param input - The notification configuration to transform
   * @param shouldThrowError - Whether to throw an error if no timing or expression is provided
   * @returns A valid cron expression string
   * @throws NotificationConfigError if no timing or expression is provided
   * @throws CronExpressionError if the expression is invalid
   */
  private transformTimingExpression<E extends boolean = boolean>(
    input: NotificationConfig,
    shouldThrowError: E,
  ): E extends true ? CronExpression : CronExpression | undefined {
    const { timing, expression } = input

    // Use provided expression if available
    if (expression) {
      return this.getValidCronExpression(expression, shouldThrowError)
    }

    // Otherwise use timing object
    if (!timing) {
      if (shouldThrowError) {
        throw new NotificationConfigError('No timing or expression provided')
      }
      logger.error('No timing or expression provided for notification config')
      return undefined as any
    }

    const cronExpression = this.timingToCronExpression(timing)

    return this.getValidCronExpression(cronExpression, shouldThrowError)
  }

  /**
   * Validates a cron expression against the expected format
   *
   * @param expression - The cron expression to validate
   * @returns the validated cron expression
   */
  private getValidCronExpression(
    expression: string,
    shouldThrowError: boolean,
  ): string {
    try {
      return new CronPattern(expression).pattern
    } catch (_e) {
      logger.error(`Invalid cron expression: ${expression}`)
      if (shouldThrowError) {
        throw _e
      }
      return ''
    }
  }

  /**
   * Checks if a sub-job is active based on its name
   *
   * @param name - The name of the sub-job to check
   * @returns true if the sub-job is active, false otherwise
   */
  public isSubJobActive(workflowName: string, name: string): boolean {
    return DEFAULT_NOTIFICATION_CONFIGS.some((config) => {
      if (config.workflowName !== workflowName) {
        return false
      }
      const inactiveSubJobs = config.inactiveSubJobs || []
      return !inactiveSubJobs.includes(name)
    })
  }

  /**
   * Retrieves a workflow from the Mastra instance by name
   *
   * @param name - The name of the workflow to retrieve
   * @returns The workflow instance if found, null otherwise
   * @throws Error if Mastra instance is not initialized
   */
  private getMastraWorkflow(name: string): Workflow | null {
    if (!this.mastraInstance) {
      throw new Error('Mastra instance not initialized')
    }
    return this.mastraInstance.getWorkflow(name)
  }

  /**
   * Creates and starts a workflow runner for a notification
   *
   * @param workflowName - The name of the workflow to run
   */
  private startWorkflowRunner(workflowName: string): void {
    const runner = this.getMastraWorkflow(workflowName)?.createRun()
    if (!runner) {
      logger.error(`Failed to create runner for workflow: ${workflowName}`)
      return
    }

    logger.info(`Starting workflow runner for job: ${workflowName}`)
    runner.start()
  }

  /**
   * Refreshes a scheduled job by ID, creating a new job if the configuration is active
   * or stopping the existing job if it's inactive.
   *
   * @param id - The unique identifier of the job to refresh
   * @throws NotificationConfigError if no configuration is found for the given ID
   */
  public async refreshJob(id: number): Promise<void> {
    const config = DEFAULT_NOTIFICATION_CONFIGS.find(
      (config) => config.id === id,
    )

    if (!config) {
      throw new NotificationConfigError(`Configuration not found for ID: ${id}`)
    }

    if (!config.isActive) {
      this.stopJob(id)
      logger.info(`Job ${id} is inactive and has been stopped.`)
      return
    }

    // Stop existing job before creating new one
    this.stopJob(id)

    try {
      const cronExpression = this.transformTimingExpression(config, true)

      const newJob = new Cron(
        cronExpression,
        { timezone: config.timezone, protect: true },
        () => {
          logger.info(`Executing notification job: ${config.workflowName}`)
          this.startWorkflowRunner(config.workflowName)
        },
      )

      this.jobs.set(id, newJob)
      logger.info(
        `Scheduled job: ${config.workflowName} with cron expression: ${cronExpression}`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Failed to refresh job ${config.workflowName}: ${message}`)
      throw error
    }
  }

  /**
   * Stops and removes a scheduled job by ID
   *
   * @param id - The unique identifier of the job to stop
   */
  private stopJob(id: number): void {
    const job = this.jobs.get(id)
    if (job) {
      job.stop()
      this.jobs.delete(id)
      logger.info(`Stopped job: ${id}`)
    }
  }

  /**
   * Initializes the job scheduler by setting up all active notification configurations
   * as scheduled jobs. Terminates any existing jobs before initialization.
   * Logs success/failure for each job initialization attempt.
   */
  public async initializeJobScheduler(): Promise<void> {
    logger.info('Initializing scheduler...')
    logger.info('Terminating existing jobs...')
    this.terminate()

    DEFAULT_NOTIFICATION_CONFIGS.forEach((config) => {
      try {
        if (config.isActive) {
          const cronExpression = this.transformTimingExpression(config, false)
          if (!cronExpression) {
            return
          }
          const job = new Cron(
            cronExpression,
            { timezone: config.timezone, protect: true },
            () => {
              logger.info(`Executing notification job: ${config.workflowName}`)
              this.startWorkflowRunner(config.workflowName)
            },
          )

          this.jobs.set(config.id, job)
          logger.info(
            `Scheduled job: ${config.workflowName} with cron expression: ${cronExpression}`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error(
          `Failed to initialize job ${config.workflowName}: ${message}`,
        )
      }
    })

    const activeJobs = this.jobs.size
    logger.info(`Scheduler initialized with ${activeJobs} active jobs`)
  }

  /**
   * Terminates all running jobs and clears the job map.
   * Should be called when shutting down the scheduler to cleanup resources.
   */
  public terminate(): void {
    this.jobs.forEach((job) => job.stop())
    this.jobs.clear()
  }
}

export const scheduler = new Scheduler()
