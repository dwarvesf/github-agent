import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import {
  notifyDeveloperPRRequestWorkflow,
  sendPRListToDiscordWorkflow,
} from './workflows';
import { githubAgent } from './agents';

export const mastra = new Mastra({
  workflows: {
    notifyDeveloperPRRequestWorkflow,
    sendPRListToDiscordWorkflow,
  },
  agents: {
    githubAgent,
  },
  logger: createLogger({
    name: 'GH-AGENT',
    level: 'info',
  }),
});
