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
      const prs = await githubClient.getRepoPRs(GITHUB_REPO, {
        from: formatDate(new Date()),
        isMerged: false,
        isOpen: true,
      })

      // get PRs with reviewer assigned but not reviewed yet
      const todayPRsWithReviewerAssigned = prs.filter((pr) => {
        return pr.requested_reviewers && pr.review_comments === 0
      })

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
