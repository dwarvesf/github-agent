import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import {
  notifyDeveloperPRRequestWorkflow,
  sendPRListToDiscordWorkflow,
  notifyDeveloperAboutPRStatus,
} from './workflows';
import { githubAgent } from './agents';

export const mastra = new Mastra({
  workflows: {
    notifyDeveloperPRRequestWorkflow,
    sendPRListToDiscordWorkflow,
    notifyDeveloperAboutPRStatus,
  },
  agents: {
    githubAgent,
  },
  logger: createLogger({
    name: 'GH-AGENT',
    level: 'info',
  }),
});
