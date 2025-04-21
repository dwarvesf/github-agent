import { Mastra, createLogger } from '@mastra/core'
import {
  sendTodayPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
  notifyInactivePRsWorkflow,
  notifyReviewersWorkflow,
} from './workflows'
import { githubAgent } from './agents'

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
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
})
