import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { githubClient } from '../../lib/github'
import { formatDate } from '../../utils/datetime'

export const prsSchema = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    url: z.string(),
    author: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    draft: z.boolean(),
    reviewers: z.array(z.string()),
    labels: z.array(z.string()),
  }),
)

export const getOrgOpenPRsTool = createTool({
  id: 'get-org-open-prs',
  description: 'Get open pull requests across the organization',
  inputSchema: z.object({
    repo: z.string().optional(),
  }),
  outputSchema: prsSchema,
  execute: async ({ context }) => {
    console.log('>>>', 'getOrgOpenPRsTool.context', context)
    const prs = await githubClient.getOrgOpenPRs('github-agent')

    return prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      draft: pr.draft,
      reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
      labels: pr.labels.map((label) => label.name),
    }))
  },
})

export const getPrDetailsTool = createTool({
  id: 'get-pr-details',
  description: 'Get detailed information about a specific pull request',
  inputSchema: z.object({
    prNumber: z.number().describe('Pull request number'),
  }),
  outputSchema: z.object({
    number: z.number(),
    title: z.string(),
    url: z.string(),
    author: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    draft: z.boolean(),
    isWaitingForReview: z.boolean(),
    labels: z.array(z.string()),
    reviewers: z.array(z.string()),
    hasComments: z.boolean(),
    hasReviews: z.boolean(),
  }),
  execute: async ({ context }) => {
    const pr = await githubClient.getPrDetails(context.prNumber)
    const isWaitingForReview = githubClient.isWaitingForReview(pr)

    return {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      draft: pr.draft,
      isWaitingForReview,
      labels: pr.labels.map((label) => label.name),
      reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
      hasComments: pr.comments > 0 || pr.review_comments > 0,
      hasReviews: pr.reviews && pr.reviews.length > 0,
    }
  },
})

export const getTodayPRListTool = createTool({
  id: 'get-daily-pr-list-agent',
  description: 'Get a list of current pull requests',
  inputSchema: z.object({}),
  outputSchema: z
    .object({
      list: z.array(
        z.object({
          number: z.number(),
          title: z.string(),
          url: z.string(),
          author: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          draft: z.boolean(),
          isWIP: z.boolean(),
          hasMergeConflicts: z.boolean(),
          isWaitingForReview: z.boolean(),
          labels: z.array(z.string()),
          reviewers: z.array(z.string()),
          hasComments: z.boolean(),
          hasReviews: z.boolean(),
        }),
      ),
    })
    .describe('PR JSON list'),
  execute: async () => {
    const prs = await githubClient.getOrgPRs('github-agent', {
      from: formatDate(new Date()),
    })

    return {
      list: prs.map((pr) => ({
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
        draft: pr.draft,
        isWIP: githubClient.isWIP(pr),
        labels: pr.labels.map((label) => label.name),
        reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
        hasComments: pr.comments > 0 || pr.review_comments > 0,
        hasReviews: pr.reviews && pr.reviews.length > 0,
      })),
    }
  },
})

export const getPullRequestTool = createTool({
  id: 'get-pull-request',
  description: 'Get a list of pull requests',
  inputSchema: z.object({
    reviewerId: z.string().describe('Reviewer ID').optional(),
    commenterId: z.string().describe('Commenter ID').optional(),
    authorId: z.string().describe('Reviewer ID').optional(),
    isOpen: z.boolean().describe('Filter by open PRs').optional(),
    isMerged: z.boolean().describe('Filter by merged PRs').optional(),
    fromDate: z
      .string()
      .describe(
        'From date where the open PRs are created or the closed PRs are merged',
      )
      .optional(),
    toDate: z
      .string()
      .describe(
        'To date where the open PRs are created or the closed PRs are merged',
      )
      .optional(),
  }),
  outputSchema: z
    .object({
      list: z.array(
        z.object({
          number: z.number(),
          title: z.string(),
          url: z.string(),
          author: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          draft: z.boolean(),
          isWaitingForReview: z.boolean(),
          isWIP: z.boolean(),
          hasMergeConflicts: z.boolean(),
          labels: z.array(z.string()),
          reviewers: z.array(z.string()),
          hasComments: z.boolean(),
          hasReviews: z.boolean(),
        }),
      ),
    })
    .describe('PR JSON list'),
  execute: async ({ context }) => {
    const prs = await githubClient.getOrgPRs('github-agent', {
      reviewerId: context.reviewerId,
      commenterId: context.commenterId,
      from: context.fromDate,
      to: context.toDate,
      isMerged: context.isMerged,
      isOpen: context.isOpen,
      authorId: context.authorId,
    })

    return {
      list: prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        isMerged: pr.merged_at !== null,
        hasMergeConflicts: githubClient.hasMergeConflicts(pr),
        draft: pr.draft,
        isWIP: githubClient.isWIP(pr),
        isWaitingForReview: githubClient.isWaitingForReview(pr),
        labels: pr.labels.map((label) => label.name),
        reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
        hasComments: pr.comments > 0 || pr.review_comments > 0,
        hasReviews: pr.reviews && pr.reviews.length > 0,
      })),
    }
  },
})

const getCommitsToolOutputSchema = z.object({
  list: z.array(
    z.object({
      sha: z.string(),
      author: z.string(),
      url: z.string(),
      message: z.string(),
    }),
  ),
})

export type CommitsToolOutputSchema = z.infer<typeof getCommitsToolOutputSchema>

export const getCommitsTool = createTool({
  id: 'get-commits',
  description: 'Get a list of commits from a repo',
  inputSchema: z.object({
    authorId: z.string().describe('Author of the commits').optional(),
    fromDate: z
      .string()
      .describe('From date where the commits were created')
      .optional(),
    toDate: z
      .string()
      .describe('To date where the commits were created')
      .optional(),
  }),
  outputSchema: getCommitsToolOutputSchema.describe(
    'List of commits in JSON format',
  ),
  execute: async ({ context }) => {
    const commits = await githubClient.getRepoCommits('playground', {
      from: context.fromDate,
      to: context.toDate,
      authorId: context.authorId,
    })

    return {
      list: commits.map((c) => ({
        sha: c.sha.substring(0, 8),
        author: c.author.login,
        url: c.html_url,
        message: c.commit.message,
      })),
    }
  },
})
