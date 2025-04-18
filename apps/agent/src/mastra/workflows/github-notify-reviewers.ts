import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  $Enums,
  EventData,
  MemberRepository,
  OrganizationRepository,
} from '../../db'
import { discordClient } from '../../lib/discord'
import { GitHubAPIPullRequest, GitHubClient } from '../../lib/github'
import { GithubDataManager } from '../../lib/github-data-manager'
import { NotificationEmbedBuilder } from '../../lib/notification-embed'
import { PullRequest } from '../../lib/type'

// Types
interface ReviewerWithPRs {
  reviewer: string
  prList: PullRequest[]
}

interface RepoPRs {
  repoName: string
  prs: PullRequest[]
}

// Helpers
const isReviewNeeded = async (
  pr: GitHubAPIPullRequest,
  githubClient: GitHubClient,
): Promise<boolean> => {
  // Skip if no reviewers requested
  if (!pr.requested_reviewers?.length) {
    return false
  }

  // Get full PR details including reviews
  const prWithReviews = await githubClient.getPRReviews(pr)

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
      new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  )

  // Skip if PR has approvals and no pending review requests
  if (reviews.some((r) => r.state === 'APPROVED')) {
    return false
  }

  // If there are reviews, check if any activity after latest review request
  if (reviews.length > 0) {
    const latestReviewDate = new Date(reviews[0]?.submitted_at || pr.updated_at)
    // Only include if no review activity since latest review request
    return latestReviewRequestDate > latestReviewDate
  }

  // Include new PRs with no reviews that are at least 1 hour old
  return true
}

const createDiscordEmbed = (
  input: NonNullable<EventData['repositoriesPRs']>,
) => {
  return NotificationEmbedBuilder.createEmbed(input, {
    title: `🔔 Need your review`,
    color: 15158332,
  })
}

class NotifyReviewersWorkflow {
  private workflow: Workflow

  constructor() {
    this.workflow = new Workflow({
      name: 'Notify Reviewers',
    })
  }

  private async getPendingPRs(
    githubClient: GitHubClient,
    repositories: Array<{ repoName: string }>,
  ): Promise<RepoPRs[]> {
    const reposPRs: RepoPRs[] = []

    for (const repo of repositories) {
      const prs = await githubClient.getRepoPRs(repo.repoName, {
        isMerged: false,
        isOpen: true,
      })

      const needsReviewPRs = await Promise.all(
        prs.filter(async (pr) => await isReviewNeeded(pr, githubClient)),
      )

      if (needsReviewPRs.length > 0) {
        reposPRs.push({
          repoName: repo.repoName,
          prs: needsReviewPRs.map((pr) =>
            GitHubClient.convertApiPullRequestToPullRequest(pr),
          ),
        })
      }
    }

    return reposPRs
  }

  private mapReviewersToPRs(repo: RepoPRs): ReviewerWithPRs[] {
    const reviewerToPRs = new Map<string, PullRequest[]>()
    const { prs } = repo

    prs.forEach((pr) => {
      pr.reviewers.forEach((reviewer) => {
        if (!reviewerToPRs.has(reviewer)) {
          reviewerToPRs.set(reviewer, [])
        }
        reviewerToPRs.get(reviewer)?.push(pr)
      })
    })

    return Array.from(reviewerToPRs.entries()).map(([reviewer, prs]) => ({
      reviewer,
      prList: prs,
    }))
  }

  private async notifyReviewerOnPlatforms(
    reviewer: string,
    repos: NonNullable<EventData['repositoriesPRs']>,
  ): Promise<void> {
    const authorPlatformsInfo = await MemberRepository.getByGithubId(reviewer)

    for (const authorPlatformInfo of authorPlatformsInfo) {
      const { platformId, platformType: platform } = authorPlatformInfo

      if (!platformId) continue

      if (platform === $Enums.Platform.discord) {
        await discordClient.sendMessageToUser({
          userId: platformId,
          message: '',
          embed: createDiscordEmbed(repos),
        })
      }

      // TODO: Add support for slack platforms
      if (platform === $Enums.Platform.slack) {
        // Implement slack notification
      }
    }
  }

  private getPendingReviews = new Step({
    id: 'get-pending-reviews',
    execute: async () => {
      const organizations = await OrganizationRepository.list()
      if (!organizations.length) {
        throw new Error('No organizations found')
      }
      const orgReposPRs: Array<RepoPRs[]> = []
      for (const org of organizations) {
        const organizationReposInstance = new GithubDataManager()
        await organizationReposInstance.initClient(org.githubName)

        const repositories = organizationReposInstance.groupRepositories()
        const githubClient = organizationReposInstance.getGithubClient()

        const reposPRs = await this.getPendingPRs(githubClient, repositories)

        orgReposPRs.push(reposPRs)
      }
      return { orgReposPRs }
    },
  })

  private notifyReviewers = new Step({
    id: 'notify-reviewers',
    outputSchema: z.object({}),
    execute: async ({ context }) => {
      if (context.steps['get-pending-reviews']?.status === 'success') {
        const { orgReposPRs } = context.steps['get-pending-reviews'].output as {
          orgReposPRs: Array<RepoPRs[]>
        }

        for (const reposPRs of orgReposPRs) {
          const reviewerPRs: Record<
            string,
            { repositoryId: string; prList: PullRequest[] }[]
          > = {}
          reposPRs.forEach(async (repo) => {
            const reviewers = this.mapReviewersToPRs(repo)
            reviewers.forEach((item) => {
              const { reviewer, prList } = item
              reviewerPRs[reviewer] = [
                ...(reviewerPRs[reviewer] || []),
                { repositoryId: repo.repoName, prList },
              ]
            })
          })

          for (const [reviewer, repos] of Object.entries(reviewerPRs)) {
            this.notifyReviewerOnPlatforms(reviewer, repos)
          }
        }
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
