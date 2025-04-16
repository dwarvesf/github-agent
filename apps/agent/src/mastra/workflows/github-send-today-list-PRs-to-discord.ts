import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'
import { GitHubClient } from '../../lib/github'
import {
  convertArrayToMarkdownTableList,
  convertNestedArrayToTreeList,
} from '../../utils/string'
import { formatDate } from '../../utils/datetime'
import { nanoid } from 'nanoid'
import { EventRepository, NotificationType } from '../../db/event.repository'
import { EventCategory, EventType } from '../../db'
import { OrganizationRepository } from '../../db/organization.repository'
import { Repositories } from '../../db/repository'
import { ChannelRepository } from '../../db/channel.repository'
import { groupBy } from '../../utils/array'

// Schema for channel data
const channelSchema = z.object({
  id: z.number(),
  name: z.string(),
  platform: z.enum(['discord', 'slack']),
  platformChannelId: z.string(),
  repositories: z.array(
    z.object({
      id: z.number(),
      githubRepoName: z.string(),
    }),
  ),
})

type Channel = z.infer<typeof channelSchema>

// Schema for organization data
const organizationSchema = z.object({
  id: z.number(),
  githubName: z.string(),
  githubTokenId: z.string().nullable(),
  channels: z.array(channelSchema),
})

type Organization = z.infer<typeof organizationSchema>

// Step 1: Fetch all organizations with their channels and repositories
const stepFetchOrganizations = new Step({
  id: 'fetch-organizations',
  outputSchema: z.object({
    organizations: z.array(organizationSchema),
  }),
  execute: async () => {
    // Get all organizations
    const organizations = await OrganizationRepository.list({})
    const result: Organization[] = []

    // For each organization, get its channels and repositories
    for (const org of organizations) {
      // Get all channels for this organization
      const channels = await ChannelRepository.getByOrganization({
        where: { organizationId: org.id },
      })

      const channelsWithRepos: Channel[] = []

      // For each channel, get its repositories
      for (const channel of channels) {
        // Get repositories for this channel and organization
        const repositories = await Repositories.getByChannel({
          channelId: channel.id,
          organizationId: org.id,
        })

        channelsWithRepos.push({
          id: channel.id,
          name: channel.name,
          platform: channel.platform,
          platformChannelId: channel.platformChannelId,
          repositories: repositories.map((repo) => ({
            id: repo.id,
            githubRepoName: repo.githubRepoName,
          })),
        })
      }

      result.push({
        id: org.id,
        githubName: org.githubName,
        githubTokenId: org.githubTokenId,
        channels: channelsWithRepos,
      })
    }

    return { organizations: result }
  },
})

// Schema for PR data
const prSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  author: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().nullable(),
  isMerged: z.boolean(),
  isWaitingForReview: z.boolean(),
  hasMergeConflicts: z.boolean(),
  draft: z.boolean(),
  isWIP: z.boolean(),
  labels: z.array(z.string()),
  reviewers: z.array(z.string()),
  hasComments: z.boolean(),
  hasReviews: z.boolean(),
})

type PR = z.infer<typeof prSchema>

// Schema for commit data
const commitSchema = z.object({
  sha: z.string(),
  author: z.string(),
  url: z.string(),
  message: z.string(),
})

type Commit = z.infer<typeof commitSchema>

// Schema for repository data with PRs and commits
const repoDataSchema = z.object({
  orgId: z.number(),
  orgName: z.string(),
  repoId: z.number(),
  repoName: z.string(),
  todayPRs: z.array(prSchema),
  todayCommits: z.array(commitSchema),
})

type RepoData = z.infer<typeof repoDataSchema>

// Schema for channel data with repositories
const channelDataSchema = z.object({
  orgId: z.number(),
  orgName: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  platform: z.enum(['discord', 'slack']),
  repositories: z.array(repoDataSchema),
})

type ChannelData = z.infer<typeof channelDataSchema>

// Step 2: Fetch PRs and commits for each repository
const stepFetchRepoData = new Step({
  id: 'fetch-repo-data',
  outputSchema: z.object({
    channelDataList: z.array(channelDataSchema),
  }),
  execute: async ({ context }) => {
    if (context.steps['fetch-organizations']?.status !== 'success') {
      throw new Error('Failed to fetch organizations')
    }

    const { organizations } = context.steps['fetch-organizations'].output
    const channelDataList: ChannelData[] = []

    for (const org of organizations) {
      // Create GitHub client for this organization
      const githubClient = new GitHubClient({
        githubOwner: org.githubName,
        githubToken: org.githubTokenId || process.env.GITHUB_TOKEN!, // Fallback to default token if not set
      })

      // Process each channel
      for (const channel of org.channels) {
        const repoDataList: RepoData[] = []

        // Process each repository in this channel
        for (const repo of channel.repositories) {
          try {
            // Fetch PRs for this repository
            const prs = await githubClient.getRepoPRs(repo.githubRepoName, {
              from: formatDate(new Date()),
            })

            // Fetch commits for this repository
            const commits = await githubClient.getRepoCommits(
              repo.githubRepoName,
              {
                from: formatDate(new Date()),
              },
            )

            repoDataList.push({
              orgId: org.id,
              orgName: org.githubName,
              repoId: repo.id,
              repoName: repo.githubRepoName,
              todayPRs: prs.map((pr) => ({
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
                reviewers: pr.requested_reviewers.map(
                  (reviewer) => reviewer.login,
                ),
                hasComments: pr.comments > 0 || pr.review_comments > 0,
                hasReviews: pr.reviews && pr.reviews.length > 0,
              })),
              todayCommits: commits.map((commit) => ({
                sha: commit.sha,
                author: commit.author.login,
                url: commit.html_url,
                message: commit.message,
              })),
            })
          } catch (error) {
            console.error(
              `Error fetching data for ${org.githubName}/${repo.githubRepoName}:`,
              error,
            )
            // Continue with other repositories instead of failing the entire workflow
          }
        }

        // Add channel data with its repositories
        if (repoDataList.length > 0) {
          channelDataList.push({
            orgId: org.id,
            orgName: org.githubName,
            channelId: channel.platformChannelId,
            channelName: channel.name,
            platform: channel.platform,
            repositories: repoDataList,
          })
        }
      }
    }

    return { channelDataList }
  },
})

// Step 3: Compose messages for each channel
const stepComposeMessages = new Step({
  id: 'compose-messages',
  outputSchema: z.object({
    messages: z.array(
      z.object({
        channelData: channelDataSchema,
        message: z.string(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    if (context.steps['fetch-repo-data']?.status !== 'success') {
      throw new Error('Failed to fetch repository data')
    }

    const { channelDataList } = context.steps['fetch-repo-data'].output
    const messages = []

    for (const channelData of channelDataList) {
      // Aggregate all PRs and commits across repositories for this channel
      let allOpenPRs: PR[] = []
      let allMergedPRs: PR[] = []
      let allWipPRs: PR[] = []
      let allNeedToReviewPRs: PR[] = []
      let allCommits: Commit[] = []

      // Process each repository
      for (const repoData of channelData.repositories) {
        const { todayPRs, todayCommits } = repoData

        // Add repository name to PR titles for clarity
        const repoOpenPRs = todayPRs
          .filter((pr: PR) => !pr.isMerged && !pr.isWIP)
          .map((pr: PR) => ({
            ...pr,
            title: `[${repoData.repoName}] ${pr.title}`,
          }))

        const repoMergedPRs = todayPRs
          .filter((pr: PR) => pr.isMerged)
          .map((pr: PR) => ({
            ...pr,
            title: `[${repoData.repoName}] ${pr.title}`,
          }))

        const repoWipPRs = todayPRs
          .filter((pr: PR) => pr.isWIP)
          .map((pr: PR) => ({
            ...pr,
            title: `[${repoData.repoName}] ${pr.title}`,
          }))

        const repoNeedToReviewPRs = todayPRs
          .filter(
            (pr: PR) => !pr.isMerged && !pr.isWIP && pr.isWaitingForReview,
          )
          .map((pr: PR) => ({
            ...pr,
            title: `[${repoData.repoName}] ${pr.title}`,
          }))

        // Add repository name to commit messages for clarity
        const repoCommits = todayCommits.map((commit: Commit) => ({
          ...commit,
          message: `[${repoData.repoName}] ${commit.message}`,
        }))

        // Aggregate
        allOpenPRs = [...allOpenPRs, ...repoOpenPRs]
        allMergedPRs = [...allMergedPRs, ...repoMergedPRs]
        allWipPRs = [...allWipPRs, ...repoWipPRs]
        allNeedToReviewPRs = [...allNeedToReviewPRs, ...repoNeedToReviewPRs]
        allCommits = [...allCommits, ...repoCommits]
      }

      // Create summary
      const summary = [
        { label: 'Open PRs', value: `**${allOpenPRs.length}**` },
        { label: 'Merged PRs', value: `**${allMergedPRs.length}**` },
        { label: 'WIP PRs', value: `**${allWipPRs.length}**` },
        { label: 'Commits', value: `**${allCommits.length}**` },
        {
          label: 'Repositories',
          value: `**${channelData.repositories.length}**`,
        },
      ]

      const representData = [
        '🔥 **Summary**',
        convertArrayToMarkdownTableList(summary, false),
      ]

      if (allOpenPRs.length > 0) {
        representData.push(
          convertNestedArrayToTreeList({
            label: '`Open PRs:`',
            children: allOpenPRs.map((pr) => ({
              label: `[#${pr.number}](${pr.url}) ${pr.title}`,
            })),
          }),
        )
      }

      if (allMergedPRs.length > 0) {
        representData.push(
          convertNestedArrayToTreeList({
            label: '\n`Merged PRs:`',
            children: allMergedPRs.map((pr) => ({
              label: `[#${pr.number}](${pr.url}) ${pr.title}`,
            })),
          }),
        )
      }

      if (allWipPRs.length > 0) {
        representData.push(
          convertNestedArrayToTreeList({
            label: '\n`WIP PRs:`',
            children: allWipPRs.map((pr) => ({
              label: `[#${pr.number}](${pr.url}) ${pr.title}`,
            })),
          }),
        )
      }

      if (allNeedToReviewPRs.length > 0) {
        representData.push(
          convertNestedArrayToTreeList({
            label: '\n`Need to review PRs:`',
            children: allNeedToReviewPRs.map((pr) => ({
              label: `[#${pr.number}](${pr.url}) ${pr.title}`,
            })),
          }),
        )
      }

      if (allCommits.length > 0) {
        representData.push(
          convertNestedArrayToTreeList({
            label: '\n`Commits:`',
            children: allCommits.map((c) => ({
              label: `[${c.sha.substring(0, 8)}](${c.url}) ${c.message}`,
            })),
          }),
        )
      }

      const message = representData.join('\n').trim() || ''

      messages.push({
        channelData,
        message,
      })
    }
    return { messages }
  },
})

// Step 4: Send messages to appropriate channels
const stepSendMessages = new Step({
  id: 'send-messages',
  outputSchema: z.object({
    results: z.array(
      z.object({
        orgName: z.string(),
        repoName: z.string(),
        channelId: z.string(),
        platform: z.enum(['discord', 'slack']),
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    if (context.steps['compose-messages']?.status !== 'success') {
      throw new Error('Failed to compose messages')
    }

    const { messages } = context.steps['compose-messages'].output
    const results = []

    for (const { channelData, message } of messages) {
      // Instead of sending one aggregated message, send individual messages for each repository
      for (const repoData of channelData.repositories) {
        try {
          if (channelData.platform === 'discord') {
            // Filter PR and commit data for this specific repository
            const openPRs =
              repoData.todayPRs.filter((pr: PR) => !pr.isMerged && !pr.isWIP) ||
              []
            const mergedPRs =
              repoData.todayPRs.filter((pr: PR) => pr.isMerged) || []
            const wipPRs = repoData.todayPRs.filter((pr: PR) => pr.isWIP) || []
            const needToReviewPRs = repoData.todayPRs.filter(
              (pr: PR) => !pr.isMerged && !pr.isWIP && pr.isWaitingForReview,
            )

            // Create summary for this repository
            const summary = [
              { label: 'Open PRs', value: `**${openPRs.length}**` },
              { label: 'Merged PRs', value: `**${mergedPRs.length}**` },
              { label: 'WIP PRs', value: `**${wipPRs.length}**` },
              {
                label: 'Commits',
                value: `**${repoData.todayCommits.length}**`,
              },
            ]

            const representData = [
              '🔥 **Summary**',
              convertArrayToMarkdownTableList(summary, false),
            ]

            if (openPRs.length > 0) {
              representData.push(
                convertNestedArrayToTreeList({
                  label: '`Open PRs:`',
                  children: openPRs.map((pr: PR) => ({
                    label: `[#${pr.number}](${pr.url}) ${pr.title}`,
                  })),
                }),
              )
            }

            if (mergedPRs.length > 0) {
              representData.push(
                convertNestedArrayToTreeList({
                  label: '\n`Merged PRs:`',
                  children: mergedPRs.map((pr: PR) => ({
                    label: `[#${pr.number}](${pr.url}) ${pr.title}`,
                  })),
                }),
              )
            }

            if (wipPRs.length > 0) {
              representData.push(
                convertNestedArrayToTreeList({
                  label: '\n`WIP PRs:`',
                  children: wipPRs.map((pr: PR) => ({
                    label: `[#${pr.number}](${pr.url}) ${pr.title}`,
                  })),
                }),
              )
            }

            if (needToReviewPRs.length > 0) {
              representData.push(
                convertNestedArrayToTreeList({
                  label: '\n`Need to review PRs:`',
                  children: needToReviewPRs.map((pr: PR) => ({
                    label: `[#${pr.number}](${pr.url}) ${pr.title}`,
                  })),
                }),
              )
            }

            if (repoData.todayCommits.length > 0) {
              representData.push(
                convertNestedArrayToTreeList({
                  label: '\n`Commits:`',
                  children: repoData.todayCommits.map((c: Commit) => ({
                    label: `[${c.sha.substring(0, 8)}](${c.url}) ${c.message}`,
                  })),
                }),
              )
            }

            const repoMessage =
              representData.join('\n').trim() || 'No activity today'

            await discordClient.sendMessageToChannel({
              channelId: channelData.channelId,
              embed: {
                title: `🤖 Daily report (${formatDate(new Date(), 'MMMM d, yyyy')}) for ${repoData.repoName}`,
                description: repoMessage,
                color: 15158332,
                footer: {
                  text: `${channelData.orgName}/${repoData.repoName}`,
                },
              },
            })
          } else {
            throw new Error(`Unsupported platform ${channelData.platform}`)
          }

          results.push({
            orgName: channelData.orgName,
            repoName: repoData.repoName,
            channelId: channelData.channelId,
            platform: channelData.platform,
            success: true,
          })
        } catch (error) {
          results.push({
            orgName: channelData.orgName,
            repoName: repoData.repoName,
            channelId: channelData.channelId,
            platform: channelData.platform,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    return { results }
  },
})

// Step 5: Log events
const stepLogEvents = new Step({
  id: 'log-events',
  execute: async ({ context }) => {
    if (
      context.steps['send-messages']?.status !== 'success' ||
      context.steps['compose-messages']?.status !== 'success'
    ) {
      throw new Error('Failed to send messages or compose messages')
    }

    const { results } = context.steps['send-messages'].output
    const { messages } = context.steps['compose-messages'].output

    // Group results by channel
    const resultsByChannel = groupBy(results, (result: any) => result.channelId)

    for (const channelId in resultsByChannel) {
      const channelResults = resultsByChannel[channelId]
      const channelMessage = messages.find(
        (m: any) => m.channelData.channelId === channelId,
      )

      if (!channelMessage) continue

      const ctxId = nanoid()

      // Find all repositories for this channel
      const repoResults = channelResults || []
      const successfulRepos = repoResults
        .filter((r) => r.success)
        .map((r) => r.repoName)
      const failedRepos = repoResults
        .filter((r) => !r.success)
        .map((r) => r.repoName)

      // Get all PRs and commits for successful repos
      const allPRs = channelMessage.channelData.repositories
        .filter((repo: RepoData) => successfulRepos.includes(repo.repoName))
        .flatMap((repo: RepoData) =>
          repo.todayPRs.map((pr: PR) => ({
            ...pr,
            repoName: repo.repoName,
          })),
        )

      const allCommits = channelMessage.channelData.repositories
        .filter((repo: RepoData) => successfulRepos.includes(repo.repoName))
        .flatMap((repo: RepoData) =>
          repo.todayCommits.map((commit: Commit) => ({
            ...commit,
            repoName: repo.repoName,
          })),
        )

      await EventRepository.logEvent({
        workflowId: 'sendTodayPRListToDiscordWorkflow',
        eventCategory: EventCategory.NOTIFICATION_DISCORD,
        eventType: EventType.REPORT_PR_LIST,
        organizationId: channelMessage.channelData.orgName,
        repositoryId: successfulRepos.join(','),
        eventData: {
          notificationType: NotificationType.DAILY_REPORT,
          message: `Sent ${successfulRepos.length} repository reports to channel`,
          prList: allPRs,
          commitList: allCommits,
          discordChannelId: channelId,
        },
        metadata: {
          success: repoResults.some((r) => r.success),
          successfulRepos,
          failedRepos,
          errors: repoResults.filter((r) => !r.success).map((r) => r.error),
          channelName: channelMessage.channelData.channelName,
          repositoryCount: channelMessage.channelData.repositories.length,
        },
        contextId: ctxId,
        tags: [
          'daily-report',
          'github',
          'pr-list',
          'commit-list',
          channelMessage.channelData.platform,
        ],
      })
    }

    return context
  },
})

// Create and commit the workflow
const sendTodayPRListToDiscordWorkflow = new Workflow({
  name: 'Send daily PR List to Discord',
})
  .step(stepFetchOrganizations)
  .then(stepFetchRepoData)
  .then(stepComposeMessages)
  .then(stepSendMessages)
  .then(stepLogEvents)

sendTodayPRListToDiscordWorkflow.commit()

export { sendTodayPRListToDiscordWorkflow }
