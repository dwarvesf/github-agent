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
import { GitHubAPIPullRequest } from '../../lib/github'
import { RepositoryDMChannelUser } from '../../lib/repository-dm-user'
import { PullRequest } from '../../lib/type'
import { groupBy } from '../../utils/array'
import { prTitleFormatValid } from '../../utils/string'
import { suggestPRDescriptionAgent } from '../agents/analyze-github-prs'
import {
  NotificationEmbedBuilder,
  NotificationTemplate,
  NotificationEmbed,
} from '../../lib/notification-embed'

// Types
type Platform = $Enums.Platform
type AuthorPRData = {
  platforms?: Awaited<ReturnType<typeof MemberRepository.getByGithubId>>
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

  private static async logEvent(
    eventCategory: EventCategory,
    notificationType: NotificationType,
    userId: string,
    repositoriesPRs: EventData['repositoriesPRs'],
    context: NotificationContext,
    embed: NotificationEmbed,
    response: unknown,
  ): Promise<void> {
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
    item: AuthorPRData,
    notificationType: NotificationType,
    itemsDisplay: EventData['repositoriesPRs'] | undefined,
  ): Promise<void> {
    if (!item.platforms?.length || !itemsDisplay?.length) return

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

        const context: NotificationContext = {
          ctxId: nanoid(),
          organizationId: item.organizationId,
        }

        const eventCategory = this.getEventCategory(platformType)

        await this.logEvent(
          eventCategory,
          notificationType,
          platform.platformId,
          itemsDisplay,
          context,
          embed,
          response,
        )
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

const processPRNotifications = async (
  results: PRsByAuthor,
  notificationType: NotificationType,
  filterFn: (pr: PullRequest) => boolean | Promise<boolean>,
): Promise<void> => {
  for (const item of Object.values(results)) {
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

    await NotificationService.notify(item, notificationType, itemsDisplay)
  }
}

const handleApprovedNotMerged = async (results: PRsByAuthor): Promise<void> => {
  await processPRNotifications(
    results,
    NotificationType.PR_PENDING_MERGE,
    (pr) => pr.isApprovedWaitingForMerging ?? false,
  )
}

const handleUnconventionalTitleOrDescription = async (
  results: PRsByAuthor,
): Promise<void> => {
  await processPRNotifications(
    results,
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
            const organizationReposInstance = new RepositoryDMChannelUser()
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
                    return githubClient.convertApiPullRequestToPullRequest(
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
                  const platformInfo =
                    await MemberRepository.getByGithubId(author)
                  results[author] = {
                    data: [
                      {
                        repo: repoPRs.repo,
                        prs,
                      },
                    ],
                    organizationId: repoPRs.org,
                    platforms: platformInfo,
                  }
                } else {
                  results[author].data.push({
                    repo: repoPRs.repo,
                    prs,
                  })
                }
              }
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
