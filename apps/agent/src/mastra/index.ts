import { Mastra } from '@mastra/core/mastra'
import { createLogger } from '@mastra/core/logger'
import {
  notifyDeveloperPRRequestWorkflow,
  sendTodayPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
} from './workflows'
import { githubAgent } from './agents'

export const mastra = new Mastra({
  workflows: {
    notifyDeveloperPRRequestWorkflow,

    sendTodayPRListToDiscordWorkflow,
    notifyDeveloperAboutPRStatus,
  },
  agents: {
    githubAgent,
  },
  logger: createLogger({
    name: 'GH-AGENT',
    level: 'info',
  }),
})
