import { Step, Workflow } from '@mastra/core/workflows'
import { getTodayPRListTool } from '../tools'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'
import { groupBy } from '../../utils/array'
import { PullRequest } from '../../lib/type'
import { DISCORD_GITHUB_MAP } from '../../constants/discord'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'
import { convertNestedArrayToTreeList } from '../../utils/string'

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

async function handleUnconventionalTitleOrDescription(
  discordUserId: string,
  prs: PullRequest[],
) {
  const readyToCheckPRs = prs.filter((pr: PullRequest) => !pr.isWIP)
  const titleFormatRegex = /^([a-zA-Z]+)(\([\w-]+(,[\w-]+)*\))?\:\s(.+)$/

  const wrongConventionPRs = await Promise.all(
    readyToCheckPRs.map(async (pr: PullRequest) => {
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
      }

      // if either title or description is not good
      if (
        !titleFormatRegex.test(pr.title) ||
        agentResponseText.suggestion_needed
      ) {
        return pr
      }
      return null
    }),
  ).then((results) => results.filter((pr): pr is PullRequest => pr !== null))

  if (wrongConventionPRs.length > 0) {
    const notifyMessage =
      '\n\n• Ensure title follows: `type(scope?): message`\n• Include a clear description of the problem and solution'

    const listInText = wrongConventionPRs
      .map((pr) => `[#${pr.number}](${pr.url}) | ${pr.title}`)
      .join('\n')

    const embed = {
      title: `📝 Improve PR clarity`,
      color: 15158332,
      description: `${listInText}${notifyMessage}`,
      inline: false,
    }

    await discordClient.sendMessageToUser({
      userId: discordUserId,
      message: '',
      embed,
    })

    return wrongConventionPRs
  }

  return []
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
              await handleUnconventionalTitleOrDescription(discordUserId, prs)
            }
          }),
        )

        return 'ok'
      },
    }),
  )

notifyDeveloperAboutPRStatus.commit()

export { notifyDeveloperAboutPRStatus }
