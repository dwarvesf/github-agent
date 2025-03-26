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

  // Check all PR descriptions in one batch
  let prsNeedingDescriptionImprovement: PullRequest[] = []

  if (readyToCheckPRs.length > 0) {
    try {
      const agentResponse = await suggestPRDescriptionAgent.generate([
        {
          role: 'user',
          content: JSON.stringify(
            readyToCheckPRs.map((pr) => ({
              url: pr.url,
              title: pr.title,
              body: pr.body,
            })),
          ),
        },
      ])

      try {
        const prsNeedingImprovement = JSON.parse(agentResponse.text) as string[]
        if (Array.isArray(prsNeedingImprovement)) {
          // test
          prsNeedingImprovement.push(
            'https://github.com/dwarvesf/github-agent/pull/12',
          )
          prsNeedingDescriptionImprovement = readyToCheckPRs.filter((pr) =>
            prsNeedingImprovement.includes(pr.url),
          )
        } else {
          console.error('Invalid response format from LLM:', agentResponse.text)
        }
      } catch (parseError) {
        console.error('Failed to parse LLM response:', parseError)
      }
    } catch (agentError) {
      console.error('Failed to get LLM suggestions:', agentError)
    }
  }

  // Check for invalid titles
  const invalidTitlePRs = readyToCheckPRs.filter(
    (pr) => !titleFormatRegex.test(pr.title),
  )

  // Combine both sets of PRs using Set to remove duplicates
  const wrongConventionPRs = Array.from(
    new Set([...invalidTitlePRs, ...prsNeedingDescriptionImprovement]),
  )

  if (wrongConventionPRs.length > 0) {
    const notifyMessage =
      '\n\n• Ensure title follows: `type(scope?): message`\n• Include a clear description of the problem and solution'

    const listInText = wrongConventionPRs
      .map((pr) => {
        return `[#${pr.number}](${pr.url}) | ${pr.title}`
      })
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
  }

  return wrongConventionPRs
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

        const byAuthor = groupBy(
          output?.list || [],
          (pr: PullRequest) => pr.author,
        )

        await Promise.all(
          Object.entries(byAuthor).map(async ([author, prs]) => {
            const discordUserId =
              DISCORD_GITHUB_MAP[author as keyof typeof DISCORD_GITHUB_MAP]
            if (discordUserId) {
              await handleMergeConflicts(discordUserId, prs as PullRequest[])
              await handleWaitingForReview(discordUserId, prs as PullRequest[])
              await handleUnconventionalTitleOrDescription(
                discordUserId,
                prs as PullRequest[],
              )
            }
          }),
        )

        return 'ok'
      },
    }),
  )

notifyDeveloperAboutPRStatus.commit()

export { notifyDeveloperAboutPRStatus }
