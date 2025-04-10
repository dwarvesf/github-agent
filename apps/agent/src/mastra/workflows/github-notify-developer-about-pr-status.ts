import { Step, Workflow } from '@mastra/core/workflows'
import { DISCORD_GITHUB_MAP } from '../../constants/discord'
import { discordClient } from '../../lib/discord'
import { GITHUB_OWNER, GITHUB_REPO, githubClient } from '../../lib/github'
import { PullRequest } from '../../lib/type'
import { groupBy } from '../../utils/array'
import { formatDate } from '../../utils/datetime'
import { prTitleFormatValid } from '../../utils/string'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'
import { EventRepository, NotificationType } from '../../db/event.repository'

import { nanoid } from 'nanoid'
import { EventCategory, EventType } from '../../db'

async function handleApprovedNotMerged(
  discordUserId: string,
  prs: PullRequest[],
  ctxId: string,
) {
  const approvedNotMergedPRs = prs.filter(
    (pr: PullRequest) => pr.isApprovedWaitingForMerging,
  )

  if (approvedNotMergedPRs.length > 0) {
    const isPlural = approvedNotMergedPRs.length > 1
    const embed = {
      title: `✅ ${isPlural ? 'Your PRs are' : 'Your PR is'} approved and ready to merge`,
      color: 3066993, // Green color
      fields: approvedNotMergedPRs.map((pr) => ({
        name: `#${pr.number} ${pr.title}`,
        value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
        inline: false,
      })),
    }

    const response = await discordClient.sendMessageToUser({
      userId: discordUserId,
      message: '',
      embed,
    })

    // Log event for merge conflicts notification
    await EventRepository.logEvent({
      workflowId: 'notifyDeveloperAboutPRStatus',
      eventCategory: EventCategory.NOTIFICATION_DISCORD,
      eventType: EventType.PR_NOTIFIED,
      organizationId: GITHUB_OWNER!,
      repositoryId: GITHUB_REPO!,
      eventData: {
        notificationType: NotificationType.PR_PENDING_MERGE,
        message: embed.title,
        prList: approvedNotMergedPRs,
        discordUserId: discordUserId,
        details: {
          embed,
        },
      },
      metadata: {
        response,
      },
      contextId: ctxId,
      tags: ['notification', 'discord', 'pr-pending-merge', 'pr-status'],
    })
  }
}

async function handleUnconventionalTitleOrDescription(
  discordUserId: string,
  prs: PullRequest[],
  ctxId: string,
) {
  const readyToCheckPRs = prs.filter((pr: PullRequest) => !pr.isWIP)

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
    (pr) => !prTitleFormatValid(pr.title),
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

    const response = await discordClient.sendMessageToUser({
      userId: discordUserId,
      message: '',
      embed,
    })

    // Log event
    await EventRepository.logEvent({
      workflowId: 'notifyDeveloperAboutPRStatus',
      eventCategory: EventCategory.NOTIFICATION_DISCORD,
      eventType: EventType.PR_NOTIFIED,
      organizationId: GITHUB_OWNER!,
      repositoryId: GITHUB_REPO!,
      eventData: {
        notificationType: NotificationType.WRONG_CONVENTION,
        message: embed.title,
        prList: wrongConventionPRs,
        discordUserId: discordUserId,
        details: {
          embed,
        },
      },
      metadata: {
        response,
      },
      contextId: ctxId,
      tags: ['notification', 'discord', 'wrong-convention', 'pr-status'],
    })
  }

  return wrongConventionPRs
}

const notifyDeveloperAboutPRStatus = new Workflow({
  name: 'Notify developer about PR status',
})
  .step(
    new Step({
      id: 'get-today-pr-list',
      execute: async () => {
        const prs = await githubClient.getRepoPRs(GITHUB_REPO, {
          from: formatDate(new Date()),
          isMerged: false,
          isOpen: true,
        })

        const todayPRsWithReviews = await Promise.all(
          prs.map((pr) => {
            return githubClient.getPRReviews(pr)
          }),
        )

        return {
          todayPRs: todayPRsWithReviews.map((pr) => ({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            mergedAt: pr.merged_at,
            isMerged: pr.merged_at !== null,
            isWaitingForReview: githubClient.isWaitingForReview(pr),
            hasMergeConflicts: githubClient.hasMergeConflicts(pr),
            isApprovedWaitingForMerging:
              githubClient.isApprovedButNotMerged(pr),
            draft: pr.draft,
            isWIP: githubClient.isWIP(pr),
            labels: pr.labels.map((label) => label.name),
            reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
            hasComments: pr.comments > 0 || pr.review_comments > 0,
            hasReviews: pr.reviews && pr.reviews.length > 0,
            body: pr.body,
          })),
        }
      },
    }),
  )
  .then(
    new Step({
      id: 'send-to-discord',
      execute: async ({ context }) => {
        if (context.steps['get-today-pr-list']?.status === 'success') {
          const { todayPRs } = context.steps['get-today-pr-list'].output as {
            todayPRs: PullRequest[]
          }
          const byAuthor = groupBy(
            todayPRs || [],
            (pr: PullRequest) => pr.author,
          )
          const ctxId = nanoid()

          await Promise.all(
            Object.entries(byAuthor).map(async ([author, prs]) => {
              const discordUserId =
                DISCORD_GITHUB_MAP[author as keyof typeof DISCORD_GITHUB_MAP]
              if (discordUserId) {
                await handleApprovedNotMerged(
                  discordUserId,
                  prs as PullRequest[],
                  ctxId,
                )
                await handleUnconventionalTitleOrDescription(
                  discordUserId,
                  prs as PullRequest[],
                  ctxId,
                )
              }
            }),
          )

          return 'ok'
        }
      },
    }),
  )

notifyDeveloperAboutPRStatus.commit()

export { notifyDeveloperAboutPRStatus }
