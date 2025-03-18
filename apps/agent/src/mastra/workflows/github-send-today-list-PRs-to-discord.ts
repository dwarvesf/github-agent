import { Step, Workflow } from '@mastra/core/workflows';
import { getTodayPRListTool } from '../tools';
import * as z from 'zod';
import { DISCORD_CHANNEL_ID, discordClient } from '../../lib/discord';
import { PullRequest } from '../../lib/type';
import { GITHUB_OWNER, GITHUB_REPO } from '../../lib/github';

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
const sendTodayPRListToDiscordWorkflow = new Workflow({
  name: 'Send daily PR List to Discord',
})
  .step(getTodayPRListTool)
  .then(
    new Step({
      id: 'send-to-discord',
      description: 'Send Todays PR list to Discord',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ context }) => {
        const output = context?.getStepResult<{ list: PullRequest[] }>(
          getTodayPRListTool.id,
        );
        const fields =
          output?.list.map((pr) => ({
            name: `#${pr.number} ${pr.title}`,
            value: `by [${pr.author}](https://github.com/${pr.author}) | ${getStatusEmoji(pr)} ${getStatus(pr)} | created at ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
            inline: false,
          })) || [];

        if (fields.length === 0) {
          return await discordClient.sendMessageToChannel({
            channelId: DISCORD_CHANNEL_ID,
            embed: {
              title: '🏖️ Github daily report',
              description: 'No PRs found today',
              color: 3447003,
              footer: {
                text: `${GITHUB_OWNER}/${GITHUB_REPO}`,
              },
            },
          });
        }

        return await discordClient.sendMessageToChannel({
          channelId: DISCORD_CHANNEL_ID,
          embed: {
            title: '📌 Github daily report',
            color: 3447003,
            fields,
            footer: {
              text: `${GITHUB_OWNER}/${GITHUB_REPO}`,
            },
          },
        });
      },
    }),
  );

sendTodayPRListToDiscordWorkflow.commit();

export { sendTodayPRListToDiscordWorkflow };
