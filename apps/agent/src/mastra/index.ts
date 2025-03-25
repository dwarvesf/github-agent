import { Mastra } from '@mastra/core/mastra'
import { createLogger } from '@mastra/core/logger'
import {
  sendTodayPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
  notifyInactivePRsWorkflow,
} from './workflows'
import { githubAgent } from './agents'

export const mastra = new Mastra({
  workflows: {
    sendTodayPRListToDiscordWorkflow,
    notifyDeveloperAboutPRStatus,
    notifyInactivePRsWorkflow,
  },
  agents: {
    githubAgent,
  },
  logger: createLogger({
    name: 'GH-AGENT',
    level: 'info',
  }),
})
