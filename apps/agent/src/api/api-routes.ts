import { Config } from '@mastra/core'
import { registerApiRoute } from '@mastra/core/server'
import { scheduler } from '../lib/scheduler'
import {
  CRON_JOBS_REFRESH_SCHEMA,
  CRON_JOBS_SCHEMA,
} from '../openapi/schema/cronjob'

type HonoOpenAPIRoute = NonNullable<
  NonNullable<Config['server']>['apiRoutes']
>[number]

export const apiRoutes: HonoOpenAPIRoute[] = [
  registerApiRoute('/refresh-cronjobs', {
    method: 'POST',
    openapi: CRON_JOBS_SCHEMA,
    handler: async (context) => {
      try {
        await scheduler.initializeJobScheduler()
        return context.json({
          message: 'Cron jobs was refreshed successfully',
        })
      } catch (error) {
        console.error('Error refreshing cron jobs:', error)
        return context.json(
          {
            message: 'Failed to refresh cron jobs',
            error,
          },
          500,
        )
      }
    },
  }),
  registerApiRoute('/refresh-cronjobs/:id', {
    method: 'POST',
    openapi: CRON_JOBS_REFRESH_SCHEMA,
    handler: async (context) => {
      const { id } = context.req.param()
      if (!id) {
        return context.json(
          {
            message: 'Job ID is required',
          },
          400,
        )
      }
      try {
        await scheduler.refreshJob(Number(id))
        return context.json({
          message: `Cron job: ${id} was refreshed successfully`,
        })
      } catch (error) {
        console.error('Error refreshing cron job:', error)
        return context.json(
          {
            message: 'Failed to refresh cron job',
            error,
          },
          500,
        )
      }
    },
  }),
]
