import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { DISCORD_GITHUB_MAP } from '../../constants/discord'
import {
  Event,
  EventCategory,
  EventRepository,
  EventType,
  NotificationType,
} from '../../db'
import { discordClient } from '../../lib/discord'
import { GITHUB_OWNER, GITHUB_REPO, githubClient } from '../../lib/github'
import { PullRequest } from '../../lib/type'
import { NotificationTimingService } from '../../lib/notification-timing'
import { startOfDay } from 'date-fns'

interface ReviewerData {
  reviewer: string
  pendingPRs: Array<{
    prNumber: number
    prURL: string
    title: string
    author: string
  }>
}

interface NotificationEventMetadata {
  notifiedTimes: string[]
  [key: string]: unknown
}

interface NotificationEventData {
  notificationType: NotificationType
  message: string
  prList: Array<{
    number: number
    title: string
    url: string
    author: string
  }>
  reviewer: string
  details: {
    embed: {
      title: string
      color: number
      description: string
      inline: boolean
    }
  }
}

class NotifyReviewersWorkflow {
  private workflow: Workflow

  constructor() {
    this.workflow = new Workflow({
      name: 'Notify Reviewers',
    })
  }

  private getPendingReviews = new Step({
    id: 'get-pending-reviews',
    execute: async () => {
      // get all PR
      const prs = await githubClient.getRepoPRs(GITHUB_REPO, {
        isMerged: false,
        isOpen: true,
      })

      // get PRs with reviewer assigned but not reviewed yet
      const allPRsWithReviewerAssigned = await Promise.all(
        prs.filter(async (pr) => {
          // Get full PR details including reviews
          const prWithReviews = await githubClient.getPRReviews(pr)

          // Skip if no reviewers requested
          if (!pr.requested_reviewers?.length) {
            return false
          }

          // Get the latest review request timestamp
          const latestReviewRequestDate = new Date(pr.updated_at)

          // Check if review request is at least 1 hour old
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          if (latestReviewRequestDate > oneHourAgo) {
            return false
          }

          // Get all reviews sorted by date descending
          const reviews = (prWithReviews.reviews || []).sort(
            (a, b) =>
              new Date(b.submitted_at).getTime() -
              new Date(a.submitted_at).getTime(),
          )

          // Skip if PR has approvals and no pending review requests
          if (reviews.some((r) => r.state === 'APPROVED')) {
            return false
          }

          // If there are reviews, check if any activity after latest review request
          if (reviews.length > 0) {
            const latestReviewDate = new Date(
              reviews[0]?.submitted_at || pr.updated_at,
            )
            // Only include if no review activity since latest review request
            return latestReviewRequestDate > latestReviewDate
          }

          // Include new PRs with no reviews that are at least 1 hour old
          return true
        }),
      )

      return {
        todayPRs: allPRsWithReviewerAssigned.map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author: pr.user.login,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          mergedAt: pr.merged_at,
          isMerged: pr.merged_at !== null,
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
  })

  private processReviewers = new Step({
    id: 'process-reviewers',
    outputSchema: z.object({
      reviewers: z.array(
        z.object({
          reviewer: z.string(),
          pendingPRs: z.array(
            z.object({
              prNumber: z.number(),
              prURL: z.string(),
              title: z.string(),
              author: z.string(),
            }),
          ),
        }),
      ),
    }),
    execute: async ({ context }) => {
      if (context.steps['get-pending-reviews']?.status === 'success') {
        const { todayPRs } = context.steps['get-pending-reviews'].output as {
          todayPRs: PullRequest[]
        }

        // Create a map of reviewers to their assigned PRs
        const reviewerToPRs = new Map<
          string,
          Array<{
            prNumber: number
            prURL: string
            title: string
            author: string
          }>
        >()

        // Iterate through PRs and build the reviewer mapping
        todayPRs.forEach((pr) => {
          pr.reviewers.forEach((reviewer) => {
            if (!reviewerToPRs.has(reviewer)) {
              reviewerToPRs.set(reviewer, [])
            }
            reviewerToPRs.get(reviewer)?.push({
              prNumber: pr.number,
              prURL: pr.url,
              title: pr.title,
              author: pr.author,
            })
          })
        })

        // Convert map to array format
        const reviewers = Array.from(reviewerToPRs.entries()).map(
          ([reviewer, prs]) => ({
            reviewer,
            pendingPRs: prs,
          }),
        )

        return { reviewers }
      }
      return { reviewers: [] }
    },
  })

  private checkNotificationHistory = new Step({
    id: 'check-notification-history',
    outputSchema: z.object({
      reviewers: z.array(
        z.object({
          reviewer: z.string(),
          pendingPRs: z.array(
            z.object({
              prNumber: z.number(),
              prURL: z.string(),
              title: z.string(),
              author: z.string(),
            }),
          ),
          shouldNotify: z.boolean(),
          lastEvent: z.custom<Event>().optional(),
        }),
      ),
    }),
    execute: async ({ context }) => {
      if (context.steps['process-reviewers']?.status === 'success') {
        const { reviewers } = context.steps['process-reviewers'].output as {
          reviewers: ReviewerData[]
        }

        // Get last notification time for each reviewer
        const reviewersWithHistory = await Promise.all(
          reviewers.map(async (reviewer) => {
            // Get all notifications for this reviewer in the last 24 hours
            const lastEvent = await EventRepository.findLastEvent({
              organizationId: GITHUB_OWNER!,
              eventCategories: [EventCategory.NOTIFICATION_DISCORD],
              eventTypes: [EventType.PR_NOTIFIED],
              tags: [
                'reviewer-notification',
                'pending-review',
                'discord',
                'github',
              ],
              fromDate: startOfDay(new Date()), // From start of current date for resetting on each day
              eventData: {
                notificationType: NotificationType.REVIEWER_REMINDER,
                reviewer: reviewer.reviewer,
              },
            })

            // Use NotificationTimingService to check if we should notify
            const { shouldNotify } =
              NotificationTimingService.checkNotificationHistory(lastEvent)

            return {
              reviewer: reviewer.reviewer,
              pendingPRs: reviewer.pendingPRs,
              shouldNotify,
              lastEvent: (lastEvent || {}) as Event,
            }
          }),
        )

        return { reviewers: reviewersWithHistory }
      }
      return { reviewers: [] }
    },
  })

  private sendDiscordNotifications = new Step({
    id: 'send-discord-notifications',
    outputSchema: z.object({}),
    execute: async ({ context }) => {
      if (context.steps['check-notification-history']?.status === 'success') {
        const { reviewers } = context.steps['check-notification-history']
          .output as {
          reviewers: Array<
            ReviewerData & { shouldNotify: boolean; lastEvent?: Event }
          >
        }

        // for each reviewer, send a message to discord and log event
        await Promise.all(
          reviewers.map(async (reviewer) => {
            if (!reviewer.shouldNotify) {
              return
            }

            const discordUserId =
              DISCORD_GITHUB_MAP[
                reviewer.reviewer as keyof typeof DISCORD_GITHUB_MAP
              ]

            // Create Discord embed
            const embed = {
              title: `🔔 Need your review`,
              color: 15158332,
              description: `${reviewer.pendingPRs.map((pr) => `- [${pr.prNumber}](${pr.prURL}) | ${pr.title}`).join('\n')}`,
              inline: false,
            }

            // Send Discord notification
            const response = await discordClient.sendMessageToUser({
              userId: discordUserId,
              message: '',
              embed,
            })

            // Log event for each notification
            const eventData: NotificationEventData = {
              notificationType: NotificationType.REVIEWER_REMINDER,
              message: embed.title,
              prList: reviewer.pendingPRs.map((pr) => ({
                number: pr.prNumber,
                title: pr.title,
                url: pr.prURL,
                author: pr.author,
              })),
              reviewer: reviewer.reviewer,
              details: {
                embed,
              },
            }

            await EventRepository.logEvent({
              eventCategory: EventCategory.NOTIFICATION_DISCORD,
              eventType: EventType.PR_NOTIFIED,
              organizationId: GITHUB_OWNER!,
              eventData,
              metadata: {
                response,
                notifiedTimes: [
                  ...((reviewer.lastEvent?.metadata as any)?.notifiedTimes ||
                    []),
                  new Date().toISOString(),
                ],
              },
              tags: [
                'reviewer-notification',
                'pending-review',
                'discord',
                'github',
              ],
            })
          }),
        )
      }
      return {}
    },
  })

  public configure() {
    return this.workflow
      .step(this.getPendingReviews)
      .then(this.processReviewers)
      .then(this.checkNotificationHistory)
      .then(this.sendDiscordNotifications)
  }

  public commit() {
    this.workflow.commit()
  }

  public getWorkflow() {
    return this.workflow
  }
}

const notifyReviewersWorkflow = new NotifyReviewersWorkflow()
notifyReviewersWorkflow.configure()
notifyReviewersWorkflow.commit()

const workflow = notifyReviewersWorkflow.getWorkflow()

export { workflow as notifyReviewersWorkflow }
