import { Mastra } from '@mastra/core'
import {
  sendTodayPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
  notifyInactivePRsWorkflow,
  notifyReviewersWorkflow,
} from './workflows'
import { githubAgent } from './agents'
import { logger } from '../utils/logger'

export const mastra: Mastra = new Mastra({
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
