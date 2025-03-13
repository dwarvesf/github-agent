import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { githubClient } from '../../lib/github';

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
);

export const getOrgOpenPRsTool = createTool({
  id: 'get-org-open-prs',
  description: 'Get open pull requests across the organization',
  inputSchema: z.object({
    repo: z.string().optional(),
  }),
  outputSchema: prsSchema,
  execute: async ({ context }) => {
    console.log('>>>', 'getOrgOpenPRsTool.context', context);
    const prs = await githubClient.getOrgOpenPRs('github-agent');

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
    }));
  },
});

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
    const pr = await githubClient.getPrDetails(context.prNumber);
    const isWaitingForReview = githubClient.isWaitingForReview(pr);

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
    };
  },
});

export const getPRListTool = createTool({
  id: 'get-pr-list-agent',
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
    const prs = await githubClient.getOrgPRs('github-agent');

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
        draft: pr.draft,
        isWaitingForReview: githubClient.isWaitingForReview(pr),
        labels: pr.labels.map((label) => label.name),
        reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
        hasComments: pr.comments > 0 || pr.review_comments > 0,
        hasReviews: pr.reviews && pr.reviews.length > 0,
      })),
    };
  },
});
