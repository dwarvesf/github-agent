import { Config } from '@mastra/core'

type HonoOpenAPISchema = NonNullable<
  NonNullable<Config['server']>['apiRoutes']
>[number]['openapi']

export const CRON_JOBS_SCHEMA: HonoOpenAPISchema = {
  summary: 'Refresh cron jobs',
  description: 'Refresh the cron jobs for notifications',
  tags: ['Cron Jobs'],
  responses: {
    200: {
      description: 'Cron jobs refreshed successfully',
    },
    500: {
      description: 'Failed to refresh cron jobs',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: {
                type: 'string',
                description: 'Error message',
              },
              message: {
                type: 'string',
                description: 'Error message',
              },
            },
          },
          example: {
            error: 'Failed to refresh cron jobs',
            message: 'Failed to refresh cron jobs',
          },
        },
      },
    },
  },
}

export const CRON_JOBS_REFRESH_SCHEMA: HonoOpenAPISchema = {
  summary: 'Refresh a specific cron job',
  description: 'Refresh a specific cron job for notifications',
  tags: ['Refresh Specific Cron Job'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'ID of the cron job to refresh',
      schema: {
        type: 'string',
      },
    },
  ],
  responses: {
    200: {
      description: 'Cron job refreshed successfully',
    },
    400: {
      description: 'Job ID is required',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Error message',
              },
            },
            example: {
              message: 'Job ID is required',
            },
          },
        },
      },
    },
    500: {
      description: 'Failed to refresh cron job',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: {
                type: 'string',
                description: 'Error message',
              },
              message: {
                type: 'string',
                description: 'Error message',
              },
            },
            example: {
              error: 'Failed to refresh cron job',
              message: 'Failed to refresh cron job',
            },
          },
        },
      },
    },
  },
}
