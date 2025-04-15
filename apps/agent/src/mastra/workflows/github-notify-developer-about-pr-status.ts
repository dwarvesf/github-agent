import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { $Enums, EventCategory, EventType, MemberRepository } from '../../db'
import { EventRepository, NotificationType } from '../../db/event.repository'
import { discordClient } from '../../lib/discord'
import { GitHubAPIPullRequest, GitHubClient } from '../../lib/github'
import { PullRequest } from '../../lib/type'
import { RepositoryDMChannelUser } from '../../lib/repository-dm-user'
import { groupBy } from '../../utils/array'
import { prTitleFormatValid } from '../../utils/string'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'

// Types
type NotificationContext = {
  ctxId: string
  organizationId: string
  repositoryId: string
  platform: $Enums.Platform
}

type NotificationEmbed = {
  title: string
  color: number
  description?: string
  fields?: Array<{
    name: string
    value: string
    inline: boolean
  }>
}

// Helper Functions
function createPRNotificationEmbed(
  organizationId: string,
  prs: PullRequest[],
  type: 'approved' | 'convention',
): NotificationEmbed {
  if (type === 'approved') {
    const isPlural = prs.length > 1
    return {
      title: `✅ ${isPlural ? 'Your PRs are' : 'Your PR is'} approved and ready to merge`,
      description: `\`${organizationId}:\`.`,
      color: 3066993, // Green color
      fields: prs.map((pr) => ({
        name: `#${pr.number} ${pr.title}`,
        value: `Created at: ${new Date(pr.createdAt).toISOString().split('T')[0]} | [link](${pr.url})`,
        inline: false,
      })),
    }
  }

  const listInText = prs
    .map((pr) => `[#${pr.number}](${pr.url}) | ${pr.title}`)
    .join('\n')
  const notifyMessage =
    '\n\n• Ensure title follows: `type(scope?): message`\n• Include a clear description of the problem and solution'

  return {
    title: '📝 Improve PR clarity',
    color: 15158332,
    description: [
      `\`${organizationId}:\``,
      `${listInText}${notifyMessage}`,
    ].join('\n'),
  }
}

async function logNotificationEvent(
  eventCategory: EventCategory,
  notificationType: NotificationType,
  userId: string,
  prs: PullRequest[],
  context: NotificationContext,
  embed: NotificationEmbed,
  response: unknown,
) {
  try {
    await EventRepository.logEvent({
      workflowId: 'notifyDeveloperAboutPRStatus',
      eventCategory,
      eventType: EventType.PR_NOTIFIED,
      organizationId: context.organizationId,
      repositoryId: context.repositoryId,
      eventData: {
        notificationType,
        message: embed.title,
        prList: prs,
        discordUserId: userId,
        details: { embed },
      },
      metadata: { response },
      contextId: context.ctxId,
      tags: ['notification', 'discord', notificationType, 'pr-status'],
    })
  } catch (error) {
    console.error(`Failed to log notification event: ${error}`)
  }
}

async function analyzeConventions(prs: PullRequest[]): Promise<PullRequest[]> {
  const readyToCheckPRs = prs.filter((pr) => !pr.isWIP)
  if (readyToCheckPRs.length === 0) return []

  let prsNeedingDescriptionImprovement: PullRequest[] = []

  try {
    // Check PR descriptions using LLM
    const agentResponse = await suggestPRDescriptionAgent.generate([
      {
        role: 'user',
        content: JSON.stringify(
          readyToCheckPRs.map((pr) => ({
            url: pr.url,
            title: pr.title,
            body: pr.body,
          })),
        ),
      },
    ])

    const jsonContent =
      agentResponse.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ||
      agentResponse.text
    const prsNeedingImprovement = JSON.parse(jsonContent) as string[]

    if (Array.isArray(prsNeedingImprovement)) {
      prsNeedingDescriptionImprovement = readyToCheckPRs.filter((pr) =>
        prsNeedingImprovement.includes(pr.url),
      )
    }
  } catch (error) {
    console.error('Failed to analyze PR descriptions:', error)
  }

  // Check PR titles
  const invalidTitlePRs = readyToCheckPRs.filter(
    (pr) => !prTitleFormatValid(pr.title),
  )

  // Combine and deduplicate
  return Array.from(
    new Set([...invalidTitlePRs, ...prsNeedingDescriptionImprovement]),
  )
}

async function handleApprovedNotMerged(
  userId: string,
  prs: PullRequest[],
  context: NotificationContext,
) {
  try {
    const approvedNotMergedPRs = prs.filter(
      (pr) => pr.isApprovedWaitingForMerging,
    )
    if (approvedNotMergedPRs.length === 0) return

    if (context.platform === $Enums.Platform.discord) {
      const embed = createPRNotificationEmbed(
        context.organizationId,
        approvedNotMergedPRs,
        'approved',
      )
      const response = await discordClient.sendMessageToUser({
        userId,
        message: '',
        embed,
      })

      await logNotificationEvent(
        EventCategory.NOTIFICATION_DISCORD,
        NotificationType.PR_PENDING_MERGE,
        userId,
        approvedNotMergedPRs,
        context,
        embed,
        response,
      )
    }
  } catch (error) {
    console.error(`Failed to handle approved PRs notification: ${error}`)
  }
}

async function handleUnconventionalTitleOrDescription(
  userId: string,
  prs: PullRequest[],
  context: NotificationContext,
) {
  try {
    const wrongConventionPRs = await analyzeConventions(prs)
    if (wrongConventionPRs.length === 0) {
      return
    }

    if (context.platform === $Enums.Platform.discord) {
      const embed = createPRNotificationEmbed(
        context.organizationId,
        wrongConventionPRs,
        'convention',
      )
      const response = await discordClient.sendMessageToUser({
        userId,
        message: '',
        embed,
      })

      await logNotificationEvent(
        EventCategory.NOTIFICATION_DISCORD,
        NotificationType.WRONG_CONVENTION,
        userId,
        wrongConventionPRs,
        context,
        embed,
        response,
      )
    }

    // TODO: Slack platform
    if (context.platform === $Enums.Platform.slack) {
      //
    }
  } catch (error) {
    console.error(`Failed to handle convention check notification: ${error}`)
  }
}

const notifyDeveloperAboutPRStatus = new Workflow({
  name: 'Notify developer about PR status',
  triggerSchema: z.object({
    organizationOwner: z.string(),
  }),
})
  .step(
    new Step({
      id: 'get-today-pr-list',
      execute: async ({ context }) => {
        try {
          const organizationReposInstance = new RepositoryDMChannelUser()
          await organizationReposInstance.initClient(
            context.triggerData.organizationOwner,
          )

          const repositories = organizationReposInstance.groupRepositories()
          const githubClient = organizationReposInstance.getGithubClient()

          // Get PRs from all repositories
          const allPRs = await Promise.all(
            repositories.map(async (repo) => {
              const prs = (await githubClient.getRepoPRs(repo.repoName, {
                isMerged: false,
                isOpen: true,
              })) as unknown as GitHubAPIPullRequest[]
              return { repo: repo.repoName, prs }
            }),
          )

          // Process PR details with reviews
          const todayPRsWithReviews = await Promise.all(
            allPRs.map(async (item) => {
              const prs = await Promise.all(
                item.prs.map(async (pr) => {
                  const prWithReviews = await githubClient.getPRReviews(pr)
                  return githubClient.convertApiPullRequestToPullRequest(
                    prWithReviews,
                  )
                }),
              )

              return {
                org: context.triggerData.organizationOwner,
                repo: item.repo,
                prs,
              }
            }),
          )

          return {
            channels: organizationReposInstance.getOrganizationData().channels,
            todayPRs: todayPRsWithReviews,
          }
        } catch (error) {
          console.error('Failed to fetch PR list:', error)
          throw error
        }
      },
    }),
  )
  .then(
    new Step({
      id: 'send-to-discord',
      execute: async ({ context }) => {
        if (context.steps['get-today-pr-list']?.status !== 'success') {
          return
        }

        try {
          const { todayPRs } = context.steps['get-today-pr-list'].output as {
            todayPRs: { org: string; repo: string; prs: PullRequest[] }[]
            channels: Awaited<
              ReturnType<typeof GitHubClient.getOrganizationData>
            >['channels']
          }

          await Promise.all(
            todayPRs.map(async (repoPRs) => {
              const byAuthor = groupBy(
                repoPRs.prs,
                (pr: PullRequest) => pr.author,
              )

              const authorPromises = Object.entries(byAuthor).map(
                async ([author, prs]) => {
                  const platformInfo =
                    await MemberRepository.getByGithubId(author)
                  if (!platformInfo.length) return

                  const notificationContext = {
                    ctxId: nanoid(),
                    organizationId: repoPRs.org,
                    repositoryId: repoPRs.repo,
                  }

                  await Promise.all(
                    platformInfo.map(async (platform) => {
                      if (!platform.platformId) return

                      await handleApprovedNotMerged(platform.platformId, prs, {
                        ...notificationContext,
                        platform: platform.platformType as $Enums.Platform,
                      })

                      await handleUnconventionalTitleOrDescription(
                        platform.platformId,
                        prs,
                        {
                          ...notificationContext,
                          platform: platform.platformType as $Enums.Platform,
                        },
                      )
                    }),
                  )
                },
              )

              await Promise.all(authorPromises)
            }),
          )

          return 'ok'
        } catch (error) {
          console.error('Failed to process notifications:', error)
          throw error
        }
      },
    }),
  )

notifyDeveloperAboutPRStatus.commit()

export { notifyDeveloperAboutPRStatus }
