import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'
import { GITHUB_REPO, githubClient } from '../../lib/github'
import { PullRequest } from '../../lib/type'
import { formatDate } from '../../utils/datetime'
import { DISCORD_GITHUB_MAP } from '../../constants/discord'

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
      const todayPRsWithReviewerAssigned = await Promise.all(
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
        todayPRs: todayPRsWithReviewerAssigned.map((pr) => ({
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

  private notifyReviewers = new Step({
    id: 'notify-reviewers',
    outputSchema: z.object({}),
    execute: async ({ context }) => {
      if (context.steps['get-pending-reviews']?.status === 'success') {
        const { todayPRs } = context.steps['get-pending-reviews'].output as {
          todayPRs: PullRequest[]
        }

        // Create a map of reviewers to their assigned PRs
        const reviewerToPRs = new Map<
          string,
          Array<{ prNumber: number; prURL: string; title: string }>
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

        // for each reviewer, send a message to discord
        await Promise.all(
          reviewers.map(async (reviewer) => {
            const discordUserId =
              DISCORD_GITHUB_MAP[
                reviewer.reviewer as keyof typeof DISCORD_GITHUB_MAP
              ]
            const embed = {
              title: `🔔 Need your review`,
              color: 15158332,
              description: `${reviewer.pendingPRs.map((pr) => `- [${pr.prNumber}](${pr.prURL}) | ${pr.title}`).join('\n')}`,
              inline: false,
            }

            await discordClient.sendMessageToUser({
              userId: discordUserId,
              message: '',
              embed,
            })
          }),
        )
      }
      return 'ok'
    },
  })

  public configure() {
    return this.workflow.step(this.getPendingReviews).then(this.notifyReviewers)
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
