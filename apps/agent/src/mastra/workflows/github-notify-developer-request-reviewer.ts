import { Step, Workflow } from '@mastra/core/workflows';
import { getPRListTool } from '../tools';
import * as z from 'zod';
import { discordClient } from '../../lib/discord';
import { groupBy } from '../../utils/array';

const discordGithubMap = {
  zlatanpham: '790170208228212766',
  vdhieu: '797044001579597846',
  'R-Jim': '797044001579597846',
};

const notifyDeveloperRequestReviewer = new Workflow({
  name: 'Notify developer request reviewer',
})
  .step(getPRListTool)
  .then(
    new Step({
      id: 'send-to-discord',
      description: 'Send PR list to Discord',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ context }) => {
        const output = context?.getStepResult<{ list: any[] }>(
          getPRListTool.id,
        );
        const watingForReview = groupBy(
          output?.list.filter((pr: any) => pr.isWaitingForReview) || [],
          (pr) => pr.author,
        );

        await Promise.all(
          Object.entries(watingForReview).map(async ([author, prs]) => {
            const discordUserId =
              discordGithubMap[author as keyof typeof discordGithubMap];
            if (discordUserId) {
              const message =
                prs.length === 1
                  ? `Is your PR [${prs[0].title}](${prs[0].url}) ready for review?`
                  : `Are your PRs ready for review?\n${prs
                      .map((pr) => `- [${pr.title}](${pr.url})`)
                      .join('\n')}`;

              await discordClient.sendMessageToUser({
                message,
                userId: discordUserId,
              });
            }
          }),
        );

        return 'ok';
      },
    }),
  );

notifyDeveloperRequestReviewer.commit();

export { notifyDeveloperRequestReviewer };
