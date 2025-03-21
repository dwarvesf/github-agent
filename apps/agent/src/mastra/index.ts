import { Mastra } from '@mastra/core/mastra'
import { createLogger } from '@mastra/core/logger'
import {
  notifyDeveloperPRRequestWorkflow,
  sendTodayPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
  suggestPRsDescription,
} from './workflows'
import { githubAgent } from './agents'

export const mastra = new Mastra({
  workflows: {
    notifyDeveloperPRRequestWorkflow,
    sendTodayPRListToDiscordWorkflow,
    notifyDeveloperAboutPRStatus,
    suggestPRsDescription,
  },
  agents: {
    githubAgent,
  },
  logger: createLogger({
    name: 'GH-AGENT',
    level: 'info',
  }),
})
