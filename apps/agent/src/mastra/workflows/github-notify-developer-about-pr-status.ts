import { Step, Workflow } from '@mastra/core/workflows'
import { nanoid } from 'nanoid'
import {
  $Enums,
  EventCategory,
  EventType,
  MemberRepository,
  OrganizationRepository,
} from '../../db'
import {
  EventData,
  EventRepository,
  NotificationType,
} from '../../db/event.repository'
import { discordClient } from '../../lib/discord'
import { GitHubAPIPullRequest, GitHubClient } from '../../lib/github'
import { GithubDataManager } from '../../lib/github-data-manager'
import {
  NotificationEmbed,
  NotificationEmbedBuilder,
  NotificationTemplate,
} from '../../lib/notification-embed'
import { NotificationTimingService } from '../../lib/notification-timing'
import { PullRequest } from '../../lib/type'
import { groupBy } from '../../utils/array'
import { prTitleFormatValid } from '../../utils/string'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'
import { NOTIFICATION_CONFIG } from '../../constants/notification'
import { getStartOfDateInTz } from '../../utils/datetime'

// Types
type Platform = $Enums.Platform
type AuthorPRData = {
  platforms?: Array<
    Awaited<ReturnType<typeof MemberRepository.getByGithubId>>[number] & {
      notifiedTimes?: string[]
    }
  >
  organizationId: string
  data: Array<{
    repo: string
    prs: PullRequest[]
  }>
}
type PRsByAuthor = Record<string, AuthorPRData>

interface NotificationContext {
  ctxId: string
  organizationId: string
}

const EMBED_COLORS = {
  SUCCESS: 3066993, // Green
  WARNING: 15158332, // Orange
} as const

const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  approvedPRs: {
    title: (count: number) =>
      `✅ ${count > 1 ? 'Your PRs are' : 'Your PR is'} approved and ready to merge`,
    color: EMBED_COLORS.SUCCESS,
  },
  conventionIssues: {
    title: '📝 Improve PR clarity',
    color: EMBED_COLORS.WARNING,
    description:
      '• Ensure title follows: `type(scope?): message`\n• Include a clear description of the problem and solution',
  },
}

class NotificationService {
  private static getEventCategory(platformType: Platform): EventCategory {
    switch (platformType) {
      case $Enums.Platform.discord:
        return EventCategory.NOTIFICATION_DISCORD
      case $Enums.Platform.slack:
        return EventCategory.NOTIFICATION_SLACK
      default:
        throw new Error(`Unsupported platform type: ${platformType}`)
    }
  }

  private static async logEvent(p: {
    eventCategory: EventCategory
    notificationType: NotificationType
    userId: string
    githubId: string
    repositoriesPRs: EventData['repositoriesPRs']
    context: NotificationContext
    embed: NotificationEmbed
    response: unknown
    platformType: Platform
    notifiedTimes: string[]
  }): Promise<void> {
    const {
      eventCategory,
      notificationType,
      userId,
      githubId,
      repositoriesPRs,
      context,
      embed,
      response,
      platformType,
      notifiedTimes,
    } = p
    try {
      await EventRepository.logEvent({
        workflowId: 'notifyDeveloperAboutPRStatus',
        eventCategory,
        eventType: EventType.PR_NOTIFIED,
        organizationId: context.organizationId,
        eventData: {
          notificationType,
          message: embed.title,
          repositoriesPRs,
          discordUserId: userId,
          reviewer: githubId,
          details: { embed, notifiedTimes },
        },
        metadata: { response },
        contextId: context.ctxId,
        tags: [
          'author-notification',
          platformType,
          notificationType,
          'pr-status',
        ],
      })
    } catch (error) {
      console.error(`Failed to log notification event: ${error}`)
    }
  }

  private static async sendNotification(
    platformType: Platform,
    userId: string,
    embed: NotificationEmbed,
  ): Promise<unknown> {
    switch (platformType) {
      case $Enums.Platform.discord:
        return discordClient.sendMessageToUser({
          userId,
          message: '',
          embed,
        })
      case $Enums.Platform.slack:
        // TODO: Implement Slack notification
        return null
      default:
        throw new Error(`Unsupported platform: ${platformType}`)
    }
  }

  static async notify(
    author: string,
    item: AuthorPRData,
    notificationType: NotificationType,
    itemsDisplay: EventData['repositoriesPRs'] | undefined,
  ): Promise<void> {
    if (!item.platforms?.length || !itemsDisplay?.length) {
      return
    }

    const template =
      notificationType === NotificationType.PR_PENDING_MERGE
        ? NOTIFICATION_TEMPLATES.approvedPRs
        : NOTIFICATION_TEMPLATES.conventionIssues

    for (const platform of item.platforms) {
      try {
        const embed = NotificationEmbedBuilder.createEmbed(
          itemsDisplay,
          template!,
          notificationType === NotificationType.PR_PENDING_MERGE,
        )
        const platformType = platform.platformType as Platform
        const response = await this.sendNotification(
          platformType,
          platform.platformId,
          embed,
        )

        // Add the current time to notifiedTimes
        // to keep track of when the notification was sent
        const notifiedTimes = [
          ...(platform.notifiedTimes || []),
          new Date().toISOString(),
        ]

        // Get all organization IDs from PRs
        const orgs = EventRepository.getOrganizationsString(itemsDisplay)

        await this.logEvent({
          eventCategory: this.getEventCategory(platformType),
          notificationType,
          userId: platform.platformId,
          githubId: author,
          repositoriesPRs: itemsDisplay,
          context: {
            ctxId: nanoid(),
            organizationId: orgs,
          },
          embed,
          response,
          platformType,
          notifiedTimes,
        })
      } catch (error) {
        console.error(
          `Failed to send ${notificationType} notification: ${error}`,
        )
      }
    }
  }
}

class PRAnalyzer {
  static async analyzeConventions(prs: PullRequest[]): Promise<PullRequest[]> {
    const readyToCheckPRs = prs.filter((pr) => !pr.isWIP)
    if (readyToCheckPRs.length === 0) return []

    const [descriptionIssues, titleIssues] = await Promise.all([
      this.checkDescriptions(readyToCheckPRs),
      this.checkTitles(readyToCheckPRs),
    ])

    // Combine and deduplicate
    return Array.from(new Set([...titleIssues, ...descriptionIssues]))
  }

  private static async checkDescriptions(
    prs: PullRequest[],
  ): Promise<PullRequest[]> {
    try {
      const agentResponse = await suggestPRDescriptionAgent.generate([
        {
          role: 'user',
          content: JSON.stringify(
            prs.map((pr) => ({
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

      return Array.isArray(prsNeedingImprovement)
        ? prs.filter((pr) => prsNeedingImprovement.includes(pr.url))
        : []
    } catch (error) {
      console.error('Failed to analyze PR descriptions:', error)
      return []
    }
  }

  private static checkTitles(prs: PullRequest[]): PullRequest[] {
    return prs.filter((pr) => !prTitleFormatValid(pr.title))
  }
}

async function filterPRsNeedNotificationByAuthor(
  results: PRsByAuthor,
  platformType: Platform,
  notificationType: NotificationType,
): Promise<PRsByAuthor> {
  const notifications: PRsByAuthor = {}

  for (const [author, authorData] of Object.entries(results)) {
    const platforms = authorData.platforms
    if (!platforms?.length) {
      continue
    }
    for (const platform of platforms) {
      if (platform.platformType !== platformType) {
        continue
      }
      const latestEvent = await EventRepository.findLastEvent({
        workflowId: 'notifyDeveloperAboutPRStatus',
        eventTypes: [EventType.PR_NOTIFIED],
        eventData: {
          notificationType,
          reviewer: author,
        },
        fromDate: getStartOfDateInTz(new Date()), // Start from today for resetting notified times
        tags: [
          'author-notification',
          platformType,
          notificationType,
          'pr-status',
        ],
      })
      const notifyHistory = NotificationTimingService.checkNotificationHistory(
        (latestEvent?.eventData as EventData)?.details?.notifiedTimes,
        // TODO: Use a config for an uniq member + platform instead of a constant
        NOTIFICATION_CONFIG,
      )
      if (!notifyHistory.shouldNotify) {
        continue
      }
      const modifiedPlatformNotifiedTimes = {
        ...platform,
        notifiedTimes: [...notifyHistory.notifiedTimes],
      }

      const notificationPlatforms = notifications[author]?.platforms || []

      notifications[author] = {
        ...authorData,
        platforms: [...notificationPlatforms, modifiedPlatformNotifiedTimes],
      }
    }
  }
  return notifications
}

const processPRNotifications = async (
  results: PRsByAuthor,
  notificationType: NotificationType,
  filterFn: (pr: PullRequest) => boolean | Promise<boolean>,
): Promise<void> => {
  for (const [author, item] of Object.entries(results)) {
    const itemsDisplay: EventData['repositoriesPRs'] = []

    for (const { repo, prs } of item.data) {
      const filteredPRs = await Promise.all(
        prs.map(async (pr) => {
          const shouldInclude = await Promise.resolve(filterFn(pr))
          return shouldInclude ? pr : null
        }),
      )
      const validPRs = filteredPRs.filter(
        (pr): pr is PullRequest => pr !== null,
      )

      if (validPRs.length > 0) {
        itemsDisplay.push({
          repositoryId: repo,
          prList: validPRs,
        })
      }
    }

    await NotificationService.notify(
      author,
      item,
      notificationType,
      itemsDisplay,
    )
  }
}

const handleApprovedNotMerged = async (results: PRsByAuthor): Promise<void> => {
  // Filter PRs that are approved but not merged
  const approvedNotMergedPRs = await filterPRsNeedNotificationByAuthor(
    results,
    $Enums.Platform.discord,
    NotificationType.PR_PENDING_MERGE,
  )
  await processPRNotifications(
    approvedNotMergedPRs,
    NotificationType.PR_PENDING_MERGE,
    (pr) => pr.isApprovedWaitingForMerging ?? false,
  )
}

const handleUnconventionalTitleOrDescription = async (
  results: PRsByAuthor,
): Promise<void> => {
  // Filter PRs with unconventional titles or descriptions
  const unconventionalPRs = await filterPRsNeedNotificationByAuthor(
    results,
    $Enums.Platform.discord,
    NotificationType.WRONG_CONVENTION,
  )
  // Process PRs that need to be notified
  await processPRNotifications(
    unconventionalPRs,
    NotificationType.WRONG_CONVENTION,
    async (pr): Promise<boolean> => {
      const conventions = await PRAnalyzer.analyzeConventions([pr])
      return conventions.length > 0
    },
  )
}

const notifyDeveloperAboutPRStatus = new Workflow({
  name: 'Notify developer about PR status',
})
  .step(
    new Step({
      id: 'get-today-pr-list',
      execute: async () => {
        const organizations = await OrganizationRepository.list()
        if (!organizations.length) {
          throw new Error('No organizations found')
        }
        const todayPRsOutput: Array<
          { org: string; repo: string; prs: PullRequest[] }[]
        > = []
        for (const organization of organizations) {
          try {
            const organizationReposInstance = new GithubDataManager()
            await organizationReposInstance.initClient(organization.githubName)

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
                    return GitHubClient.convertApiPullRequestToPullRequest(
                      prWithReviews,
                    )
                  }),
                )

                return {
                  org: organization.githubName,
                  repo: item.repo,
                  prs,
                }
              }),
            )

            todayPRsOutput.push(todayPRsWithReviews)
          } catch (error) {
            console.error('Failed to fetch PR list:', error)
            throw error
          }
        }

        return { todayPRsOutput }
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
          const { todayPRsOutput } = context.steps['get-today-pr-list']
            .output as {
            todayPRsOutput: {
              org: string
              repo: string
              prs: PullRequest[]
            }[][]
          }

          for (const todayPRs of todayPRsOutput) {
            const results: Record<
              string,
              {
                platforms?: Awaited<
                  ReturnType<typeof MemberRepository.getByGithubId>
                >
                organizationId: string
                data: { repo: string; prs: PullRequest[] }[]
              }
            > = {}
            for (const repoPRs of todayPRs) {
              if (repoPRs.prs.length === 0) {
                continue
              }
              const byAuthor = groupBy(
                repoPRs.prs,
                (pr: PullRequest) => pr.author,
              )

              for (const [author, prs] of Object.entries(byAuthor)) {
                if (!results[author]) {
                  results[author] = {
                    data: [
                      {
                        repo: repoPRs.repo,
                        prs,
                      },
                    ],
                    organizationId: repoPRs.org,
                  }
                } else {
                  results[author].data.push({
                    repo: repoPRs.repo,
                    prs,
                  })
                }
              }
            }

            const allAuthors = Object.keys(results)
            const allMembers = await MemberRepository.getByGithubIds(allAuthors)
            const allMembersById = groupBy(
              allMembers,
              (member) => member.githubId,
            )
            for (const author of Object.keys(results)) {
              const platforms = allMembersById[author]
              results[author]!.platforms = platforms || []
            }

            await handleApprovedNotMerged(results)
            await handleUnconventionalTitleOrDescription(results)
          }

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
