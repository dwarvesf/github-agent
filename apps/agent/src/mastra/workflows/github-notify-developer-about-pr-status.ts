import { Step, Workflow } from '@mastra/core/workflows'
import { getTodayPRListTool } from '../tools'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'
import { groupBy } from '../../utils/array'
import { PullRequest } from '../../lib/type'
import { DISCORD_GITHUB_MAP } from '../../constants/discord'
import { EventRepository, NotificationType } from '../../db/event.repository'
import { EventCategory, EventType } from '@prisma/client'
import { nanoid } from 'nanoid'
import { GITHUB_OWNER, GITHUB_REPO } from '../../lib/github'

async function handleMergeConflicts(
  discordUserId: string,
  prs: PullRequest[],
  ctxId: string,
) {
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

    try {
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
          notificationType: NotificationType.MERGE_CONFLICTS,
          message: embed.title,
          prList: hasMergedConflictsPRs,
          discordUserId: discordUserId,
          details: {
            embed,
          },
        },
        metadata: {
          response,
        },
        contextId: ctxId,
        tags: ['notification', 'discord', 'merge-conflicts', 'pr-status'],
      })
    } catch (error) {
      console.error(error)
    }
  }
}

async function handleWaitingForReview(
  discordUserId: string,
  prs: PullRequest[],
  ctxId: string,
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
    try {
      const response = await discordClient.sendMessageToUser({
        userId: discordUserId,
        message: '',
        embed,
      })

      // Log event for waiting for review notification
      await EventRepository.logEvent({
        workflowId: 'notifyDeveloperAboutPRStatus',
        eventCategory: EventCategory.NOTIFICATION_DISCORD,
        eventType: EventType.PR_NOTIFIED,
        organizationId: GITHUB_OWNER!,
        repositoryId: GITHUB_REPO!,
        eventData: {
          message: embed.title,
          prList: watingForReviewPrs,
          discordUserId: discordUserId,
          notificationType: NotificationType.WAITING_FOR_REVIEW,
          details: {
            embed,
          },
        },
        metadata: {
          response,
        },
        contextId: ctxId,
        tags: ['notification', 'discord', 'waiting-for-review', 'pr-status'],
      })
    } catch (error) {
      console.error(error)
    }
  }
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
        const ctxId = nanoid()

        await Promise.all(
          Object.entries(byAuthor).map(async ([author, prs]) => {
            const discordUserId =
              DISCORD_GITHUB_MAP[author as keyof typeof DISCORD_GITHUB_MAP]
            if (discordUserId) {
              // Notify developer if their PR has merge conflicts
              await handleMergeConflicts(discordUserId, prs, ctxId)

              // Notify developer if their PR needs to tag for review
              await handleWaitingForReview(discordUserId, prs, ctxId)
            }
          }),
        )

        return 'ok'
      },
    }),
  )

notifyDeveloperAboutPRStatus.commit()

export { notifyDeveloperAboutPRStatus }
