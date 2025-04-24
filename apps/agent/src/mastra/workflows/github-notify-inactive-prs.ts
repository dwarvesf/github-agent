import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'
import { GitHubClient } from '../../lib/github'
import { takeSnapshotTime } from '../../utils/datetime'
import { nanoid } from 'nanoid'
import { EventRepository, NotificationType } from '../../db/event.repository'
import { EventCategory, EventType } from '../../db'
import { OrganizationRepository } from '../../db/organization.repository'
import { Repositories } from '../../db/repository'
import { ChannelRepository } from '../../db/channel.repository'

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

interface InactivePRNotification {
  repo: string
  url: string
  prs: Array<{
    number: number
    title: string
    url: string
    author: string
    lastActivity: string
    daysInactive: number
  }>
}

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

const stepOneSchema = z.object({
  inactivePRs: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      html_url: z.string(),
      updated_at: z.string(),
      user: z.object({
        login: z.string(),
      }),
      reviews: z.array(
        z.object({
          submitted_at: z.string(),
        }),
      ),
    }),
  ),
  orgName: z.string(),
  repoName: z.string(),
  channelId: z.string(),
})

type StepOneOutput = z.infer<typeof stepOneSchema>

const stepTwoSchema = z.object({
  notificationsByRepo: z.record(
    z.string(),
    z.object({
      repo: z.string(),
      url: z.string(),
      prs: z.array(
        z.object({
          number: z.number(),
          title: z.string(),
          url: z.string(),
          author: z.string(),
          lastActivity: z.string(),
          daysInactive: z.number(),
        }),
      ),
    }),
  ),
  orgName: z.string(),
  repoName: z.string(),
  channelId: z.string(),
})

type StepTwoOutput = z.infer<typeof stepTwoSchema>

// Step 2: Fetch inactive PRs for each repository
const stepFetchInactivePRs = new Step({
  id: 'get-inactive-prs',
  outputSchema: z.array(stepOneSchema),
  execute: async ({ context }) => {
    if (context.steps['fetch-organizations']?.status !== 'success') {
      throw new Error('Failed to fetch organizations')
    }

    const { organizations } = context.steps['fetch-organizations'].output
    const results: StepOneOutput[] = []
    // Default to 3 days if inactiveDays is not provided in trigger data
    const inactiveDays = context.triggerData?.inactiveDays || 3

    for (const org of organizations) {
      // Create GitHub client for this organization
      const githubClient = new GitHubClient({
        githubOwner: org.githubName,
        githubToken: org.githubTokenId || undefined,
      })

      // Process each channel
      for (const channel of org.channels) {
        // Process each repository in this channel
        for (const repo of channel.repositories) {
          try {
            // Fetch inactive PRs for this repository using dynamic inactiveDays
            const inactivePRs = await githubClient.getInactivePRs(
              repo.githubRepoName,
              inactiveDays,
            )

            if (inactivePRs.length > 0) {
              results.push({
                inactivePRs,
                orgName: org.githubName,
                repoName: repo.githubRepoName,
                channelId: channel.platformChannelId,
              })
            }
          } catch (error) {
            console.error(
              `Error fetching inactive PRs for ${org.githubName}/${repo.githubRepoName}:`,
              error,
            )
            // Continue with other repositories instead of failing the entire workflow
          }
        }
      }
    }

    return results
  },
})

// Step 3: Process PRs by repository
const stepProcessPRsByRepo = new Step({
  id: 'process-prs-by-repo',
  outputSchema: z.array(stepTwoSchema),
  execute: async ({ context }) => {
    if (context.steps['get-inactive-prs']?.status !== 'success') {
      throw new Error('Failed to fetch inactive PRs')
    }

    const inactivePRsResults = context.steps['get-inactive-prs']
      .output as StepOneOutput[]
    const results: StepTwoOutput[] = []

    for (const result of inactivePRsResults) {
      const { inactivePRs, orgName, repoName, channelId } = result

      const notificationsByRepo = inactivePRs.reduce(
        (acc, pr) => {
          const urlParts = pr.html_url.split('/')
          const repo = urlParts[urlParts.length - 3]
          const org = urlParts[urlParts.length - 4]
          const repoURL = urlParts.slice(0, urlParts.length - 2).join('/')
          const repoName = [org, repo].join('/')

          if (!acc[repoName]) {
            acc[repoName] = {
              repo: repoName,
              url: repoURL,
              prs: [],
            }
          }

          const lastUpdated = new Date(pr.updated_at)
          let lastActivity = lastUpdated
          if (pr.reviews && pr.reviews.length > 0) {
            const lastReviewDate = new Date(
              Math.max(
                ...pr.reviews.map((r) => new Date(r.submitted_at).getTime()),
              ),
            )
            if (lastReviewDate > lastUpdated) {
              lastActivity = lastReviewDate
            }
          }
          acc[repoName].prs.push({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
            lastActivity: lastActivity.toISOString(),
            daysInactive: Math.floor(
              (new Date().getTime() - lastActivity.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          })

          return acc
        },
        {} as Record<string, InactivePRNotification>,
      )

      results.push({
        notificationsByRepo,
        orgName,
        repoName,
        channelId,
      })
    }

    return results
  },
})

// Step 4: Process Discord embed notifications
const stepProcessDiscordNotifications = new Step({
  id: 'process-embed-discord-notification',
  outputSchema: z.array(
    z.object({
      description: z.string(),
      orgName: z.string(),
      channelId: z.string(),
      notificationsByRepo: z.record(z.string(), z.any()),
      inactiveDays: z.number(),
      totalPRs: z.number(),
    }),
  ),
  execute: async ({ context }) => {
    if (
      context.steps['get-inactive-prs']?.status !== 'success' ||
      context.steps['process-prs-by-repo']?.status !== 'success'
    ) {
      throw new Error('Failed to process PRs by repo')
    }

    const processedResults = context.steps['process-prs-by-repo']
      .output as StepTwoOutput[]
    const inactivePRsResults = context.steps['get-inactive-prs']
      .output as StepOneOutput[]
    // Default to 3 days if inactiveDays is not provided in trigger data
    const inactiveDays = context.triggerData?.inactiveDays || 3

    // Group results by channel
    const resultsByChannel: Record<
      string,
      {
        orgName: string
        channelId: string
        repos: Array<{
          repoName: string
          prs: Array<{
            number: number
            title: string
            url: string
            author: string
            daysInactive: number
          }>
        }>
      }
    > = {}

    // Process and group all results by channel
    for (let i = 0; i < processedResults.length; i++) {
      const processedResult = processedResults[i]
      if (!processedResult) continue

      const { notificationsByRepo, orgName, repoName, channelId } =
        processedResult
      if (!notificationsByRepo || !orgName || !repoName || !channelId) continue

      const repoNotify = Object.values(notificationsByRepo)[0]
      if (!repoNotify?.prs?.length) continue

      // Initialize channel group if it doesn't exist
      if (!resultsByChannel[channelId]) {
        resultsByChannel[channelId] = {
          orgName,
          channelId,
          repos: [],
        }
      }

      // Add repository data to the channel group
      resultsByChannel[channelId].repos.push({
        repoName,
        prs: repoNotify.prs.map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.url,
          author: pr.author,
          daysInactive: pr.daysInactive,
        })),
      })
    }

    // Create a single message for each channel with all repositories
    const results = []
    for (const channelId in resultsByChannel) {
      const channelData = resultsByChannel[channelId]
      if (!channelData || !channelData.repos || !channelData.repos.length)
        continue

      let totalPRs = 0

      // Calculate total PRs
      channelData.repos.forEach((repo) => {
        if (repo && repo.prs) {
          totalPRs += repo.prs.length
        }
      })

      // Create description content
      let description = `📊 **Summary**\nFound **${totalPRs}** PRs inactive for ${inactiveDays}+ days across **${channelData.repos.length}** repositories.\n\n`

      // Add repository sections to description
      channelData.repos.forEach((repo) => {
        if (!repo || !repo.prs || !repo.prs.length) return

        const prCount = repo.prs.length
        const pluralSuffix = prCount === 1 ? 'inactived PR' : 'inactived PRs'

        // Add repository header
        description += `**${repo.repoName}**: (${prCount} ${pluralSuffix})\n`

        // Add each PR under the repository with the new format
        repo.prs.forEach((pr) => {
          description += `- [#${pr.number}](${pr.url}) \`${pr.title || 'No title'}\` by @${pr.author || 'Unknown'} **(${pr.daysInactive}+ days)**\n`
        })

        description += '\n'
      })

      const combinedNotificationsByRepo = processedResults.reduce(
        (acc, result) => {
          if (
            result &&
            result.channelId === channelId &&
            result.notificationsByRepo
          ) {
            return { ...acc, ...result.notificationsByRepo }
          }
          return acc
        },
        {},
      )

      results.push({
        description,
        orgName: channelData.orgName,
        channelId,
        notificationsByRepo: combinedNotificationsByRepo,
        inactiveDays,
        totalPRs,
      })
    }

    return results
  },
})

// Step 5: Send Discord notifications
const stepSendDiscordNotifications = new Step({
  id: 'send-discord-notification',
  outputSchema: z.array(
    z.object({
      success: z.boolean(),
      orgName: z.string(),
      channelId: z.string(),
      description: z.string(),
      notificationsByRepo: z.record(z.string(), z.any()),
      inactiveDays: z.number(),
      totalPRs: z.number(),
    }),
  ),
  execute: async ({ context }) => {
    if (
      context.steps['process-embed-discord-notification']?.status !== 'success'
    ) {
      throw new Error('Failed to process Discord notifications')
    }

    const notifications =
      context.steps['process-embed-discord-notification'].output || []
    const results = []

    for (const notification of notifications) {
      if (!notification) continue

      const {
        description,
        orgName,
        channelId,
        notificationsByRepo,
        inactiveDays,
        totalPRs,
      } = notification

      if (!description || !orgName || !channelId || !notificationsByRepo)
        continue

      // Skip sending notification if there are no inactive PRs
      if (totalPRs === 0) {
        continue
      }

      try {
        await discordClient.sendMessageToChannel({
          channelId,
          embed: {
            title: `👀 **Inactive work - ${totalPRs || 0} PRs need attention**`,
            description,
            color: 0xffa500,
            footer: {
              text: takeSnapshotTime(new Date()),
            },
          },
        })

        results.push({
          success: true,
          orgName,
          channelId,
          description,
          notificationsByRepo,
          inactiveDays: inactiveDays || 3,
          totalPRs: totalPRs || 0,
        })
      } catch (error) {
        results.push({
          success: false,
          orgName,
          channelId,
          description,
          notificationsByRepo,
          inactiveDays: inactiveDays || 3,
          totalPRs: totalPRs || 0,
        })
      }
    }

    return results
  },
})

// Step 6: Log events
const stepLogEvents = new Step({
  id: 'log-event',
  outputSchema: z.object({}),
  execute: async ({ context }) => {
    if (context.steps['send-discord-notification']?.status !== 'success') {
      throw new Error('Failed to send Discord notifications')
    }

    const results = context.steps['send-discord-notification'].output || []

    for (const result of results) {
      if (!result || !result.success) continue

      const {
        description,
        orgName,
        channelId,
        notificationsByRepo,
        inactiveDays,
      } = result

      if (!description || !orgName || !channelId || !notificationsByRepo)
        continue

      const ctxId = nanoid()

      await EventRepository.logEvent({
        workflowId: 'notifyInactivePRsWorkflow',
        eventCategory: EventCategory.NOTIFICATION_DISCORD,
        eventType: EventType.PR_NOTIFIED,
        organizationId: orgName,
        repositoryId: Object.keys(notificationsByRepo).join(','),
        eventData: {
          notificationType: NotificationType.WAITING_FOR_REVIEW,
          message: description,
          prList: Object.values(notificationsByRepo).flatMap(
            (repo: any) => repo?.prs || [],
          ),
          discordChannelId: channelId,
        },
        metadata: {
          inactiveDays: inactiveDays || 3,
          repositoryCount: Object.keys(notificationsByRepo).length,
        },
        contextId: ctxId,
        tags: ['inactive-prs', 'github', 'discord'],
      })
    }

    return {}
  },
})

// Create and commit the workflow
const notifyInactivePRsWorkflow = new Workflow({
  name: 'Notify Inactive PRs',
  triggerSchema: z.object({
    inactiveDays: z.number().default(3).optional(),
  }),
})
  .step(stepFetchOrganizations)
  .then(stepFetchInactivePRs)
  .then(stepProcessPRsByRepo)
  .then(stepProcessDiscordNotifications)
  .then(stepSendDiscordNotifications)
  .then(stepLogEvents)

notifyInactivePRsWorkflow.commit()

export { notifyInactivePRsWorkflow }
