import { Mastra, createLogger } from '@mastra/core'
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
    name: 'Mastra',
    level: 'debug',
  }),
})
