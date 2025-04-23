import { Mastra } from '@mastra/core'
import { apiRoutes } from '../api/api-routes'
import { scheduler } from '../lib/scheduler'
import { logger } from '../utils/logger'
import { githubAgent } from './agents'
import {
  notifyDeveloperAboutPRStatus,
  notifyInactivePRsWorkflow,
  notifyReviewersWorkflow,
  sendTodayPRListToDiscordWorkflow,
} from './workflows'

export const mastra: Mastra = new Mastra({
  server: {
    apiRoutes,
  },
  workflows: {
    sendTodayPRListToDiscordWorkflow,
    notifyDeveloperAboutPRStatus,
    notifyInactivePRsWorkflow,
    notifyReviewersWorkflow,
  },
  agents: {
    githubAgent,
  },
  logger,
})

scheduler.init(mastra)
