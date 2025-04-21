import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { GitHubAPIPullRequest, GitHubClient } from '../../lib/github'
import {
  convertArrayToMarkdownTableList,
  convertNestedArrayToTreeList,
} from '../../utils/string'
import { githubIdMapper } from '../../lib/id-mapper'
import { $Enums, OrganizationRepository, Repositories } from '../../db'
import { groupBy } from '../../utils/array'

type OrganizationData = Awaited<
  ReturnType<typeof GitHubClient.getOrganizationData>
>

async function getOrganizations(params: {
  organization?: string
  channel?: string
  repository?: string
}): Promise<OrganizationData[]> {
  const { organization, channel, repository } = params

  if (organization || channel) {
    const data = await GitHubClient.getOrganizationData(
      organization,
      channel
        ? {
            platformChannelId: channel,
            platform: $Enums.Platform.discord,
          }
        : undefined,
      repository,
    )
    return data.organization ? [data] : []
  }

  if (repository) {
    const repositories = await Repositories.getByRepositoryName(repository)
    if (!repositories.length) return []

    const organizations = await Promise.all(
      repositories.map(async (repo) => {
        const org = await OrganizationRepository.getById(repo.organizationId)
        if (!org) {
          return null
        }
        const data = await GitHubClient.getOrganizationData(
          org.githubName,
          channel
            ? {
                platformChannelId: channel,
                platform: $Enums.Platform.discord,
              }
            : undefined,
          repository,
        )
        return data.organization?.githubTokenId ? data : null
      }),
    )

    return organizations.filter((org): org is OrganizationData => org !== null)
  }

  const orgs = await OrganizationRepository.list()
  const organizations = await Promise.all(
    orgs.map(async (org) => {
      const data = await GitHubClient.getOrganizationData(org.githubName)
      return data.organization ? data : null
    }),
  )

  return organizations.filter((org): org is OrganizationData => org !== null)
}

async function fetchGitHubData<T>(
  organizations: OrganizationData[],
  fetchFn: (client: GitHubClient, repoName: string) => Promise<T[]>,
  filter?: { repository?: string },
): Promise<T[]> {
  const results: T[] = []

  for (const org of organizations) {
    if (!org.organization?.githubTokenId) continue

    const client = new GitHubClient({
      githubOwner: org.organization.githubName,
      githubToken: org.organization.githubTokenId,
    })

    for (const channel of org.channels) {
      if (!channel.repositories?.length) continue

      for (const repo of channel.repositories) {
        if (filter?.repository && repo.githubRepoName !== filter.repository)
          continue
        const data = await fetchFn(client, repo.githubRepoName)
        results.push(...data)
      }
    }
  }

  return results
}

async function mapGitHubUser(
  username: string,
  useDiscordMapping?: boolean,
): Promise<string> {
  if (!useDiscordMapping) return username
  const discordId = await githubIdMapper.getDiscordID(username)
  return discordId ? `<@!${discordId}>` : `@${username}`
}

const prListSchema = z.object({
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

export type PRListOutputSchema = z.infer<typeof prListSchema>

export const getPullRequestTool = createTool({
  id: 'get-pull-request',
  description: 'Get a list of pull requests',
  inputSchema: z.object({
    reviewerId: z.string().describe('Reviewer ID').optional(),
    commenterId: z.string().describe('Commenter ID').optional(),
    organization: z.string().describe('Organization name').optional(),
    channel: z.string().describe('Channel id').optional(),
    repository: z.string().describe('Repository name').optional(),
    authorId: z.string().describe('Reviewer ID').optional(),
    isOpen: z.boolean().describe('Filter by open PRs').optional(),
    isMerged: z.boolean().describe('Filter by merged PRs').optional(),
    useDiscordIdMapping: z
      .boolean()
      .describe('Use Discord ID mapping')
      .optional(),
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
  outputSchema: prListSchema.describe('PR JSON list'),
  execute: async ({ context }) => {
    const organizations = await getOrganizations({
      organization: context.organization,
      channel: context.channel,
      repository: context.repository,
    })

    const prs = await fetchGitHubData(
      organizations,
      (client, repoName) =>
        client.getRepoPRs(repoName, {
          reviewerId: context.reviewerId,
          commenterId: context.commenterId,
          from: context.fromDate,
          to: context.toDate,
          isMerged: context.isMerged,
          isOpen: context.isOpen,
          authorId: context.authorId,
        }),
      { repository: context.repository },
    )

    return {
      list: await Promise.all(
        prs.map(async (pr) => {
          const author = await mapGitHubUser(
            pr.user.login,
            context.useDiscordIdMapping,
          )
          const reviewers = await Promise.all(
            pr.requested_reviewers.map((reviewer) =>
              mapGitHubUser(reviewer.login, context.useDiscordIdMapping),
            ),
          )

          const convertedPR =
            GitHubClient.convertApiPullRequestToPullRequest(pr)
          return {
            number: convertedPR.number,
            title: convertedPR.title,
            url: convertedPR.url,
            createdAt: convertedPR.createdAt,
            updatedAt: convertedPR.updatedAt,
            draft: convertedPR.draft,
            isWIP: convertedPR.isWIP,
            hasMergeConflicts: convertedPR.hasMergeConflicts || false,
            isWaitingForReview: convertedPR.isWaitingForReview || false,
            labels: convertedPR.labels || [],
            hasComments: convertedPR.hasComments || false,
            hasReviews: convertedPR.hasReviews || false,
            author,
            reviewers,
          }
        }),
      ),
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
    organization: z.string().describe('Organization name').optional(),
    channel: z.string().describe('Channel id').optional(),
    repository: z.string().describe('Repository name').optional(),
    useDiscordIdMapping: z
      .boolean()
      .describe('Use Discord ID mapping')
      .optional(),
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
    const organizations = await getOrganizations({
      organization: context.organization,
      channel: context.channel,
      repository: context.repository,
    })

    const commits = await fetchGitHubData(
      organizations,
      (client, repoName) =>
        client.getRepoCommits(repoName, {
          from: context.fromDate,
          to: context.toDate,
          authorId: context.authorId,
        }),
      { repository: context.repository },
    )

    return {
      list: await Promise.all(
        commits.map(async (commit) => ({
          sha: commit.sha.substring(0, 8),
          author: await mapGitHubUser(
            commit.author.login,
            context.useDiscordIdMapping,
          ),
          url: commit.html_url,
          // Only keep the first line of the commit message
          // and remove leading and trailing spaces
          message:
            commit.commit.message.split('\n')[0]?.trim() ??
            commit.commit.message,
        })),
      ),
    }
  },
})

export const getUserActivitiesTool = createTool({
  id: 'get-user-activities-agent',
  description: 'List user activities in unstructured format',
  inputSchema: z.object({
    authorId: z.string().describe('Reviewer ID'),
    organization: z.string().describe('Organization name').optional(),
    channel: z.string().describe('Channel id').optional(),
    repository: z.string().describe('Repository name').optional(),
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
  outputSchema: z.object({ rawText: z.string() }),
  execute: async ({ context }) => {
    const organizations = await getOrganizations({
      organization: context.organization,
      channel: context.channel,
      repository: context.repository,
    })

    const prs = await fetchGitHubData(organizations, (client, repoName) =>
      client.getRepoPRs(repoName, {
        from: context.fromDate,
        to: context.toDate,
        authorId: context.authorId,
      }),
    )

    const commits = await fetchGitHubData(organizations, (client, repoName) =>
      client.getRepoCommits(repoName, {
        from: context.fromDate,
        to: context.toDate,
        authorId: context.authorId,
      }),
    )

    const openPRs = prs.filter(
      (pr: GitHubAPIPullRequest) =>
        pr.merged_at === null && !GitHubClient.isWIP(pr),
    )

    const mergedPRs = prs.filter(
      (pr: GitHubAPIPullRequest) => pr.merged_at !== null,
    )

    const wipPRs = prs.filter((pr: GitHubAPIPullRequest) =>
      GitHubClient.isWIP(pr),
    )

    const rawParticipatedPRs = prs.filter((pr: GitHubAPIPullRequest) =>
      pr.requested_reviewers.some(
        (reviewer) => reviewer.login === context.authorId,
      ),
    )

    const needToReviewPRs = rawParticipatedPRs.filter(
      (pr: GitHubAPIPullRequest) => {
        return !prs.find((p: GitHubAPIPullRequest) => p.number === pr.number)
      },
    )

    const needYouToReviewPRs = rawParticipatedPRs.filter(
      (pr: GitHubAPIPullRequest) => {
        return GitHubClient.isWaitingForReview(pr)
      },
    )

    const summary = [
      { label: 'Open PRs', value: `**${openPRs.length}**` },
      { label: 'Merged PRs', value: `**${mergedPRs.length}**` },
      { label: 'WIP PRs', value: `**${wipPRs.length}**` },
      { label: 'Need to review', value: `**${needToReviewPRs.length}**` },
      {
        label: 'Need to assign reviewer',
        value: `**${needYouToReviewPRs.length}**`,
      },
      { label: 'Commit count', value: `**${commits.length}**` },
    ]

    const representData = [
      '**📊 Summary:**',
      convertArrayToMarkdownTableList(summary, false),
    ]

    if (openPRs.length > 0) {
      representData.push('\n')
      representData.push(
        convertNestedArrayToTreeList({
          label: '`Open PRs:`',
          children: openPRs.map((pr: GitHubAPIPullRequest) => ({
            label: `[#${pr.number}](${pr.html_url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (mergedPRs.length > 0) {
      representData.push('\n')
      representData.push(
        convertNestedArrayToTreeList({
          label: '`Merged PRs:`',
          children: mergedPRs.map((pr: GitHubAPIPullRequest) => ({
            label: `[#${pr.number}](${pr.html_url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (wipPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '`WIP PRs:`',
          children: wipPRs.map((pr: GitHubAPIPullRequest) => ({
            label: `[#${pr.number}](${pr.html_url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (needToReviewPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '`Need to review:`',
          children: needToReviewPRs.map((pr: GitHubAPIPullRequest) => ({
            label: `[#${pr.number}](${pr.html_url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (needYouToReviewPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '`Need to assign reviewer:`',
          children: needYouToReviewPRs.map((pr: GitHubAPIPullRequest) => ({
            label: `[#${pr.number}](${pr.html_url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (commits.length > 0) {
      const groupedCommitByRepository = groupBy(commits, (commit) => {
        return commit.html_url.split('/')[4]!
      })
      for (const repo in groupedCommitByRepository) {
        representData.push('\n')
        representData.push(
          convertNestedArrayToTreeList({
            label: `\`${repo}:\``,
            children: groupedCommitByRepository[repo]!.map((c) => ({
              label: `[${c.sha.substring(0, 8)}](${c.html_url}) ${c.commit.message}`,
            })),
          }),
        )
      }
    }

    return {
      rawText: representData
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    }
  },
})
