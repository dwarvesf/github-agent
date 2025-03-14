import { Step, Workflow } from '@mastra/core/workflows';
import { getPRListTool, PRList, PullRequest } from '../tools';
import * as z from 'zod';
import { discordClient } from '../../lib/discord';

const getStatusEmoji = (pr: PullRequest): string => {
  if (pr.isWIP) return '🚧';
  if (pr.isWaitingForReview) return '⏳';
  if (pr.isMerged) return '✅';

  return '👀';
};

const getStatus = (pr: PullRequest): string => {
  if (pr.isWIP) return 'WIP';
  if (pr.isWaitingForReview) return 'Wait for review';
  if (pr.isMerged) return 'Merged';

  return 'Open';
};
const sendPRListToDiscordWorkflow = new Workflow({
  name: 'Send PR List to Discord',
})
  .step(getPRListTool)
  .then(
    new Step({
      id: 'send-to-discord',
      description: 'Send PR list to Discord',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ context }) => {
        const output = context?.getStepResult<PRList>(getPRListTool.id);
        const fields =
          output?.list.map((pr) => ({
            name: `#${pr.number} ${pr.title}`,
            value: `by [${pr.author}](https://github.com/${pr.author}) | ${getStatusEmoji(pr)} ${getStatus(pr)} | created at ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
            inline: false,
          })) || [];

        const response = await discordClient.sendMessageToChannel({
          channelId: '1348951204419604483',
          embed: {
            title: '📌 Github daily report',
            color: 3447003,
            fields,
            footer: {
              text: 'df-playground/playground',
            },
          },
        });

        return response;
      },
    }),
  );

sendPRListToDiscordWorkflow.commit();

export { sendPRListToDiscordWorkflow };
