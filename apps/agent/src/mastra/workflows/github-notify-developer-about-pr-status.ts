import { Step, Workflow } from '@mastra/core/workflows';
import { getPRListTool, PullRequest } from '../tools';
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
        const output = context?.getStepResult<{ list: PullRequest[] }>(
          getPRListTool.id,
        );

        const byAuthor = groupBy(output?.list || [], (pr) => pr.author);

        await Promise.all(
          Object.entries(byAuthor).map(async ([author, prs]) => {
            const discordUserId =
              discordGithubMap[author as keyof typeof discordGithubMap];
            if (discordUserId) {
              const hasMergedConflictsPRs = prs.filter(
                (pr: PullRequest) => pr.hasMergeConflicts,
              );

              // Has merge conflicts
              if (hasMergedConflictsPRs.length > 0) {
                const isPlural = hasMergedConflictsPRs.length > 1;
                const embed = {
                  title: `🚧 your ${isPlural ? 'PRs have' : 'PR has'} merge conflicts`,
                  color: 15158332,
                  fields: hasMergedConflictsPRs.map((pr) => ({
                    name: `#${pr.number} ${pr.title}`,
                    value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
                    inline: false,
                  })),
                };

                await discordClient.sendMessageToUser({
                  userId: discordUserId,
                  message: '',
                  embed,
                });
              }

              // Waiting for review
              const watingForReviewPrs = prs.filter(
                (pr: PullRequest) =>
                  pr.isWaitingForReview && !pr.hasMergeConflicts,
              );

              if (watingForReviewPrs.length > 0) {
                const isPlural = watingForReviewPrs.length > 1;
                const embed = {
                  title: `👀 ${isPlural ? ' are' : ' is'} your pull request${isPlural ? 's' : ''} ready for review?`,
                  color: 3447003,
                  fields: watingForReviewPrs.map((pr) => ({
                    name: `#${pr.number} ${pr.title}`,
                    value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
                    inline: false,
                  })),
                };

                await discordClient.sendMessageToUser({
                  userId: discordUserId,
                  message: '',
                  embed,
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
