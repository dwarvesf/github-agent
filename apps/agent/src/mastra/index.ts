import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { notifyDeveloperPRRequestWorkflow } from './workflows/github-notify-open-prs';
import { githubAgent } from './agents';

export const mastra = new Mastra({
  workflows: {
    notifyDeveloperPRRequestWorkflow,
  },
  agents: {
    githubAgent,
  },
  logger: createLogger({
    name: 'GH-AGENT',
    level: 'info',
  }),
});
