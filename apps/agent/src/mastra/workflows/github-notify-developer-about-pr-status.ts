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

const notifyDeveloperAboutPRStatus = new Workflow({
  name: 'Notify developer about PR status',
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

        const byAuthor = groupBy(output?.list || [], (pr) => pr.author);

        await Promise.all(
          Object.entries(byAuthor).map(async ([author, prs]) => {
            const discordUserId =
              discordGithubMap[author as keyof typeof discordGithubMap];
            if (discordUserId) {
              const watingForReviewPrs = prs.filter(
                (pr: any) => pr.isWaitingForReview,
              );

              if (watingForReviewPrs.length > 0) {
                const message =
                  watingForReviewPrs.length === 1
                    ? `Is your PR [${watingForReviewPrs[0].title}](${watingForReviewPrs[0].url}) ready for review?`
                    : `Are your PRs ready for review?\n${watingForReviewPrs
                        .map((pr) => `- [${pr.title}](${pr.url})`)
                        .join('\n')}`;

                await discordClient.sendMessageToUser({
                  message,
                  userId: discordUserId,
                });
              }
            }
          }),
        );

        return 'ok';
      },
    }),
  );

notifyDeveloperAboutPRStatus.commit();

export { notifyDeveloperAboutPRStatus };
