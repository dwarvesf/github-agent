import { Step, Workflow } from '@mastra/core/workflows'
import { getTodayPRListTool } from '../tools'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'
import { groupBy } from '../../utils/array'
import { PullRequest } from '../../lib/type'
import { DISCORD_GITHUB_MAP } from '../../constants/discord'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'

async function handleMergeConflicts(discordUserId: string, prs: PullRequest[]) {
  const hasMergedConflictsPRs = prs.filter(
    (pr: PullRequest) => pr.hasMergeConflicts,
  )
  // Has merge conflicts
  if (hasMergedConflictsPRs.length > 0) {
    const isPlural = hasMergedConflictsPRs.length > 1
    const embed = {
      title: `🚧 your ${isPlural ? 'PRs have' : 'PR has'} merge conflicts`,
      color: 15158332,
      fields: hasMergedConflictsPRs.map((pr) => ({
        name: `#${pr.number} ${pr.title}`,
        value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
        inline: false,
      })),
    }

    await discordClient.sendMessageToUser({
      userId: discordUserId,
      message: '',
      embed,
    })
  }
}

async function handleWaitingForReview(
  discordUserId: string,
  prs: PullRequest[],
) {
  // Waiting for review
  const watingForReviewPrs = prs.filter(
    (pr: PullRequest) => pr.isWaitingForReview && !pr.hasMergeConflicts,
  )

  if (watingForReviewPrs.length > 0) {
    const isPlural = watingForReviewPrs.length > 1
    const embed = {
      title: `👀 ${isPlural ? ' are' : ' is'} your pull request${isPlural ? 's' : ''} ready for review?`,
      color: 3447003,
      fields: watingForReviewPrs.map((pr) => ({
        name: `#${pr.number} ${pr.title}`,
        value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
        inline: false,
      })),
    }

    await discordClient.sendMessageToUser({
      userId: discordUserId,
      message: '',
      embed,
    })
  }
}

async function handleSuggestPRDescription(
  discordUserId: string,
  prs: PullRequest[],
) {
  const embed = {
    title: `Hey <@${discordUserId}>, your PR needs some improvements`,
    color: 3447003,
    fields: [] as { name: string; value: string; inline: boolean }[],
  }
  let needSuggestion = false
  // for each pr, check if it needs suggestion
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

    const agentResponseText = JSON.parse(agentResponse.text) as {
      suggestion_needed: boolean
      original_title: string
      original_body: string
      suggest_title: string
      suggest_body: string
    }

    // create discord embed
    if (agentResponseText.suggestion_needed) {
      needSuggestion = true
      embed.fields.push({
        name: `#${pr.number} ${pr.title}`,
        value: `Here are some suggestions for your PR:
          **Title**: ${agentResponseText.suggest_title}
          **Description**: ${agentResponseText.suggest_body}`,
        inline: false,
      })
    }
  }

  // send to discord
  //if (needSuggestion) {
  const res = await discordClient.sendMessageToUser({
    userId: discordUserId,
    message: '',
    embed,
  })
  //}
}

const notifyDeveloperAboutPRStatus = new Workflow({
  name: 'Notify developer about PR status',
})
  .step(getTodayPRListTool)
  .then(
    new Step({
      id: 'send-to-discord',
      description: 'Send PR list to Discord',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ context }) => {
        const output = context?.getStepResult<{ list: PullRequest[] }>(
          getTodayPRListTool.id,
        )

        const byAuthor = groupBy(output?.list || [], (pr) => pr.author)

        await Promise.all(
          Object.entries(byAuthor).map(async ([author, prs]) => {
            const discordUserId =
              DISCORD_GITHUB_MAP[author as keyof typeof DISCORD_GITHUB_MAP]
            if (discordUserId) {
              // Notify developer if their PR has merge conflicts
              await handleMergeConflicts(discordUserId, prs)

              // Notify developer if their PR needs to tag for review
              await handleWaitingForReview(discordUserId, prs)

              // Notify developer, if their PR description needs improvement
              await handleSuggestPRDescription(discordUserId, prs)
            }
          }),
        )

        return 'ok'
      },
    }),
  )

notifyDeveloperAboutPRStatus.commit()

export { notifyDeveloperAboutPRStatus }
