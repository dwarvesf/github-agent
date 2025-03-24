import { Mastra } from '@mastra/core/mastra'
import { createLogger } from '@mastra/core/logger'
import {
  sendTodayPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
} from './workflows'
import { githubAgent } from './agents'

export const mastra = new Mastra({
  workflows: {
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
