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
    const inactiveDays = 3 // Default value

    for (const org of organizations) {
      // Create GitHub client for this organization
      const githubClient = new GitHubClient({
        githubOwner: org.githubName,
        githubToken: org.githubTokenId,
      })

      // Process each channel
      for (const channel of org.channels) {
        // Process each repository in this channel
        for (const repo of channel.repositories) {
          try {
            // Fetch inactive PRs for this repository
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
      fields: z.array(
        z.object({
          value: z.string(),
          name: z.string(),
          inline: z.boolean(),
        }),
      ),
      orgName: z.string(),
      repoName: z.string(),
      channelId: z.string(),
      notificationsByRepo: z.record(z.string(), z.any()),
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
    const results = []

    for (let i = 0; i < processedResults.length; i++) {
      // Use non-null assertion to tell TypeScript these properties definitely exist
      const processedResult = processedResults[i]
      const inactivePRsResult = inactivePRsResults[i]

      if (!processedResult || !inactivePRsResult) {
        continue
      }

      const { notificationsByRepo, orgName, repoName, channelId } =
        processedResult
      const { inactivePRs } = inactivePRsResult
      const inactiveDays = 3 // Default value

      const summary = `Found **${inactivePRs.length}** PRs inactive for ${inactiveDays}+ days in repository \`${repoName}\`.`
      const repoNotify = Object.values(notificationsByRepo)[0]

      if (!repoNotify?.prs.length) {
        continue
      }

      const tableRows = repoNotify.prs
        .reduce((chunks: string[][], pr, idx: number) => {
          const row = `- **[#${pr.number}](${pr.url})** \`${pr.title}\` by @${pr.author} **(${pr.daysInactive}+ days)**`
          const chunkIndex = Math.floor(idx / 5)
          if (!chunks[chunkIndex]) {
            chunks[chunkIndex] = []
          }
          chunks[chunkIndex].push(row)
          return chunks
        }, [] as string[][])
        .map((chunk: string[]) => chunk.join('\n'))

      // Combine summary and table
      const fields = [summary, ...tableRows].map((value) => ({
        value,
        name: '',
        inline: false,
      }))

      results.push({
        fields,
        orgName,
        repoName,
        channelId,
        notificationsByRepo,
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
      repoName: z.string(),
      channelId: z.string(),
      fields: z.array(
        z.object({
          value: z.string(),
          name: z.string(),
          inline: z.boolean(),
        }),
      ),
      notificationsByRepo: z.record(z.string(), z.any()),
    }),
  ),
  execute: async ({ context }) => {
    if (
      context.steps['process-embed-discord-notification']?.status !== 'success'
    ) {
      throw new Error('Failed to process Discord notifications')
    }

    const notifications =
      context.steps['process-embed-discord-notification'].output
    const results = []

    for (const notification of notifications) {
      const { fields, orgName, repoName, channelId, notificationsByRepo } =
        notification

      try {
        await discordClient.sendMessageToChannel({
          channelId,
          embed: {
            title: `👀 **Inactive work**`,
            fields,
            color: 0xffa500,
            footer: {
              text: takeSnapshotTime(new Date()),
            },
          },
        })

        results.push({
          success: true,
          orgName,
          repoName,
          channelId,
          fields,
          notificationsByRepo,
        })
      } catch (error) {
        console.error(
          `Error sending Discord notification for ${orgName}/${repoName}:`,
          error,
        )
        results.push({
          success: false,
          orgName,
          repoName,
          channelId,
          fields,
          notificationsByRepo,
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

    const results = context.steps['send-discord-notification'].output

    for (const result of results) {
      if (result.success) {
        const { fields, orgName, repoName, channelId, notificationsByRepo } =
          result
        const ctxId = nanoid()

        await EventRepository.logEvent({
          workflowId: 'notifyInactivePRsWorkflow',
          eventCategory: EventCategory.NOTIFICATION_DISCORD,
          eventType: EventType.PR_NOTIFIED,
          organizationId: orgName,
          repositoryId: repoName,
          eventData: {
            notificationType: NotificationType.WAITING_FOR_REVIEW,
            message:
              fields?.map((f: { value: string }) => f.value).join('\n') || '',
            prList: Object.values(notificationsByRepo).flatMap(
              (repo: any) => repo.prs,
            ),
            discordChannelId: channelId,
          },
          metadata: {
            inactiveDays: 3, // Default value
          },
          contextId: ctxId,
          tags: ['inactive-prs', 'github', 'discord'],
        })
      }
    }

    return {}
  },
})

// Create and commit the workflow
const notifyInactivePRsWorkflow = new Workflow({
  name: 'Notify Inactive PRs',
})
  .step(stepFetchOrganizations)
  .then(stepFetchInactivePRs)
  .then(stepProcessPRsByRepo)
  .then(stepProcessDiscordNotifications)
  .then(stepSendDiscordNotifications)
  .then(stepLogEvents)

notifyInactivePRsWorkflow.commit()

export { notifyInactivePRsWorkflow }
