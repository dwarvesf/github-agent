import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { DISCORD_CHANNEL_ID, discordClient } from '../../lib/discord'
import {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_TOKEN,
  GitHubClient,
} from '../../lib/github'
import { takeSnapshotTime } from '../../utils/datetime'
import { nanoid } from 'nanoid'
import { EventRepository, NotificationType } from '../../db/event.repository'
import { EventCategory, EventType } from '../../db'

const githubClient = new GitHubClient({
  githubOwner: GITHUB_OWNER!,
  githubToken: GITHUB_TOKEN!,
})

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
})

type StepTwoOutput = z.infer<typeof stepTwoSchema>

class NotifyInactivePRsWorkflow {
  private workflow: Workflow
  private inactiveDays: number
  private repo: string

  constructor(repo: string, inactiveDays: number = 3) {
    this.workflow = new Workflow({
      name: 'Notify Inactive PRs',
    })
    this.inactiveDays = inactiveDays
    this.repo = repo
  }

  private stepOne = new Step({
    id: 'get-inactive-prs',
    outputSchema: stepOneSchema,
    execute: async () => {
      const inactivePRs = await githubClient.getInactivePRs(
        this.repo,
        this.inactiveDays,
      )
      return { inactivePRs }
    },
  })

  private stepTwo = new Step({
    id: 'process-prs-by-repo',
    outputSchema: stepTwoSchema,
    execute: async ({ context }) => {
      if (context.steps['get-inactive-prs']?.status === 'success') {
        const { inactivePRs } = context.steps['get-inactive-prs']
          .output as StepOneOutput

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

        return { notificationsByRepo }
      }
      return { notificationsByRepo: {} }
    },
  })

  private stepThree = new Step({
    id: 'process-embed-discord-notification',
    outputSchema: z.object({}),
    execute: async ({ context }) => {
      if (
        context.steps['get-inactive-prs']?.status === 'success' &&
        context.steps['process-prs-by-repo']?.status === 'success'
      ) {
        const { inactivePRs } = context.steps['get-inactive-prs']
          .output as StepOneOutput
        const { notificationsByRepo } = context.steps['process-prs-by-repo']
          .output as StepTwoOutput
        const summary = `Found **${inactivePRs.length}** PRs inactive for ${this.inactiveDays}+ days in repository \`${this.repo}\`.`
        const repoNotify = Object.values(notificationsByRepo)[0]

        if (!repoNotify?.prs.length) {
          return {}
        }

        const tableRows = (repoNotify?.prs || [])
          .reduce((chunks, pr, idx) => {
            const row = `- **[#${pr.number}](${pr.url})** \`${pr.title}\` by @${pr.author} **(${pr.daysInactive}+ days)**`
            const chunkIndex = Math.floor(idx / 5)
            if (!chunks[chunkIndex]) {
              chunks[chunkIndex] = []
            }
            chunks[chunkIndex].push(row)
            return chunks
          }, [] as string[][])
          .map((chunk) => chunk.join('\n'))

        // Combine summary and table
        const fields = [summary, ...tableRows].map((value) => ({
          value,
          name: '',
          inline: false,
        }))

        return {
          fields,
        }
      }
      return {}
    },
  })

  private stepFour = new Step({
    id: 'send-discord-notification',
    outputSchema: z.object({}),
    execute: async ({ context }) => {
      if (
        context.steps['get-inactive-prs']?.status === 'success' &&
        context.steps['process-prs-by-repo']?.status === 'success' &&
        context.steps['process-embed-discord-notification']?.status ===
          'success'
      ) {
        const fields =
          context.steps['process-embed-discord-notification']?.output.fields

        await discordClient.sendMessageToChannel({
          channelId: DISCORD_CHANNEL_ID,
          embed: {
            title: `👀 **Inactive work**`,
            fields,
            color: 0xffa500,
            footer: {
              text: takeSnapshotTime(new Date()),
            },
          },
        })
      }
      return {}
    },
  })

  private stepFive = new Step({
    id: 'log-event',
    outputSchema: z.object({}),
    execute: async ({ context }) => {
      if (
        context.steps['get-inactive-prs']?.status === 'success' &&
        context.steps['process-prs-by-repo']?.status === 'success' &&
        context.steps['process-embed-discord-notification']?.status ===
          'success' &&
        context.steps['send-discord-notification']?.status === 'success'
      ) {
        const { notificationsByRepo } = context.steps['process-prs-by-repo']
          .output as StepTwoOutput
        const fields =
          context.steps['process-embed-discord-notification']?.output.fields
        const ctxId = nanoid()

        await EventRepository.logEvent({
          workflowId: 'notifyInactivePRsWorkflow',
          eventCategory: EventCategory.NOTIFICATION_DISCORD,
          eventType: EventType.PR_NOTIFIED,
          organizationId: GITHUB_OWNER!,
          repositoryId: GITHUB_REPO!,
          eventData: {
            notificationType: NotificationType.WAITING_FOR_REVIEW,
            message:
              fields?.map((f: { value: string }) => f.value).join('\n') || '',
            prList: Object.values(notificationsByRepo).flatMap(
              (repo) => repo.prs,
            ),
            discordChannelId: DISCORD_CHANNEL_ID,
          },
          metadata: {
            inactiveDays: this.inactiveDays,
          },
          contextId: ctxId,
          tags: ['inactive-prs', 'github', 'discord'],
        })
      }
      return {}
    },
  })

  public configure() {
    return this.workflow
      .step(this.stepOne)
      .then(this.stepTwo)
      .then(this.stepThree)
      .then(this.stepFour, {
        when: async ({ context }) => {
          const fetchData = context?.getStepResult<{
            fields: Array<{ value: string }>
          }>('process-embed-discord-notification')
          return Boolean(fetchData?.fields.length)
        },
      })
      .then(this.stepFive)
  }

  public commit() {
    this.workflow.commit()
  }

  public getWorkflow() {
    return this.workflow
  }
}

const notifyInactivePRsWorkflow = new NotifyInactivePRsWorkflow(GITHUB_REPO)
notifyInactivePRsWorkflow.configure()
notifyInactivePRsWorkflow.commit()

const workflow = notifyInactivePRsWorkflow.getWorkflow()

export { workflow as notifyInactivePRsWorkflow }
