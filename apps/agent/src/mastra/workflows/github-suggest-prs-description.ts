import { Step, Workflow } from '@mastra/core/workflows'
import { getTodayPRListTool } from '../tools'
import * as z from 'zod'
import { discordClient } from '../../lib/discord'
import { groupBy } from '../../utils/array'
import { discordGithubMap } from './github-notify-developer-about-pr-status'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'
import { PullRequest } from '../../lib/type'

const suggestPRsDescription = new Workflow({
  name: 'Suggest improvements for PR descriptions',
})
  .step(getTodayPRListTool)
  .then(
    new Step({
      id: 'suggest-pr-description',
      description: 'Suggest improvements for PR descriptions',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ context }) => {
        // get PRs
        const output = context?.getStepResult<{ list: PullRequest[] }>(
          getTodayPRListTool.id,
        )

        // group PRs by author, map author -> PRs
        const byAuthor = groupBy(output?.list || [], (pr) => pr.author)

        // for each author
        await Promise.all(
          Object.entries(byAuthor).map(async ([author, prs]) => {
            // for each PR
            for (const pr of prs) {
              // use agent to check if PR description is good
              const prompt = `Based on the following pull request, help me determine if it needs to be improved:
                ${JSON.stringify({ title: pr.title, body: pr.body }, null, 2)}`

              // call to agent
              const agentResponse = await suggestPRDescriptionAgent.generate([
                {
                  role: 'user',
                  content: prompt,
                },
              ])

              // convert agent's response to json
              const json = JSON.parse(agentResponse.text)

              // if needed suggestion, send a message to Discord
              const discordUserId =
                discordGithubMap[author as keyof typeof discordGithubMap]
              if (json.suggestion_needed && discordUserId) {
                const message = `Hey <@${discordUserId}>, your PR needs some improvements:\n\n**Title**: ${json.suggest_title}\n\n**Description**: ${json.suggest_body}`
                // const embed = {
                //     title: `Hey <@${discordUserId}>, your PR needs some improvements`,
                //     color: 3447003,
                //     fields: watingForReviewPrs.map((pr) => ({
                //       name: `#${pr.number} ${pr.title}`,
                //       value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
                //       inline: false,
                //     })),
                //   };
                const discordResponse = await discordClient
                  .sendMessageToUser({
                    userId: discordUserId,
                    message: message,
                  })
                  .then((res) => {
                    console.log('>>>', 'discord response', res)
                    return res
                  })
                  .catch((err) => {
                    console.log('>>>', 'discord error', err)
                  })
                return discordResponse
              }
            }
          }),
        )

        return 'ok'
      },
    }),
  )

suggestPRsDescription.commit()

export { suggestPRsDescription }
