import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { DISCORD_CHANNEL_ID, discordClient } from '../../lib/discord'
import { GITHUB_OWNER, GITHUB_REPO, githubClient } from '../../lib/github'
import {
  convertArrayToMarkdownTableList,
  convertNestedArrayToTreeList,
} from '../../utils/string'
import { formatDate } from '../../utils/datetime'
import { nanoid } from 'nanoid'
import { EventRepository, NotificationType } from '../../db/event.repository'
import { EventCategory, EventType } from '../../db/.generated'

const stepOneSchema = z.object({
  todayPRs: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      url: z.string(),
      author: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      mergedAt: z.string(),
      isMerged: z.boolean(),
      isWaitingForReview: z.boolean(),
      hasMergeConflicts: z.boolean(),
      draft: z.boolean(),
      isWIP: z.boolean(),
      labels: z.array(z.string()),
      reviewers: z.array(z.string()),
      hasComments: z.boolean(),
      hasReviews: z.boolean(),
    }),
  ),
})

type StepOneOutput = z.infer<typeof stepOneSchema>

const stepOne = new Step({
  id: 'get-today-pr-list',
  outputSchema: stepOneSchema,
  execute: async () => {
    const prs = await githubClient.getRepoPRs(GITHUB_REPO, {
      from: formatDate(new Date()),
    })

    return {
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
        reviewers: pr.requested_reviewers.map((reviewer) => reviewer.login),
        hasComments: pr.comments > 0 || pr.review_comments > 0,
        hasReviews: pr.reviews && pr.reviews.length > 0,
      })),
    }
  },
})

const stepTwoSchema = z.object({
  todayCommits: z.array(
    z.object({
      sha: z.string(),
      author: z.string(),
      url: z.string(),
      message: z.string(),
    }),
  ),
})

type StepTwoOutput = z.infer<typeof stepTwoSchema>

const stepTwo = new Step({
  id: 'get-today-commits',
  outputSchema: stepTwoSchema,
  execute: async () => {
    const commits = await githubClient.getRepoCommits(GITHUB_REPO, {
      from: formatDate(new Date()),
    })

    return {
      todayCommits: commits.map((commit) => ({
        sha: commit.sha,
        author: commit.author.login,
        url: commit.html_url,
        message: commit.message,
      })),
    }
  },
})

const stepThreeSchema = z.object({
  message: z.string(),
})

type StepThreeOutput = z.infer<typeof stepThreeSchema>

const stepThree = new Step({
  id: 'compose-message',
  outputSchema: stepThreeSchema,
  execute: async ({ context }) => {
    if (
      context.steps['get-today-pr-list']?.status !== 'success' ||
      context.steps['get-today-commits']?.status !== 'success'
    ) {
      throw new Error('Failed to get today PR list or commits')
    }

    const { todayPRs } = context.steps['get-today-pr-list']
      ?.output as StepOneOutput

    const { todayCommits } = context.steps['get-today-commits']
      ?.output as StepTwoOutput

    const openPRs = todayPRs.filter((pr) => !pr.isMerged && !pr.isWIP) || []
    const mergedPRs = todayPRs.filter((pr) => pr.isMerged) || []
    const wipPRs = todayPRs.filter((pr) => pr.isWIP) || []
    const needToReviewPRs = todayPRs.filter(
      (pr) => !pr.isMerged && !pr.isWIP && pr.isWaitingForReview,
    )

    const summary = [
      { label: 'Open PRs', value: `**${openPRs.length}**` },
      { label: 'Merged PRs', value: `**${mergedPRs.length}**` },
      { label: 'WIP PRs', value: `**${wipPRs.length}**` },
      { label: 'Commits', value: `**${todayCommits.length}**` },
    ]

    const representData = [
      '🔥 **Summary**',
      convertArrayToMarkdownTableList(summary, false),
    ]

    if (openPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '`Open PRs:`',
          children: openPRs.map((pr) => ({
            label: `[#${pr.number}](${pr.url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (mergedPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '\n`Merged PRs:`',
          children: mergedPRs.map((pr) => ({
            label: `[#${pr.number}](${pr.url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (wipPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '\n`WIP PRs:`',
          children: wipPRs.map((pr) => ({
            label: `[#${pr.number}](${pr.url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (needToReviewPRs.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '\n`Need to review PRs:`',
          children: needToReviewPRs.map((pr) => ({
            label: `[#${pr.number}](${pr.url}) ${pr.title}`,
          })),
        }),
      )
    }

    if (todayCommits.length > 0) {
      representData.push(
        convertNestedArrayToTreeList({
          label: '\n`Commits:`',
          children: todayCommits.map((c) => ({
            label: `[${c.sha.substring(0, 8)}](${c.url}) ${c.message}`,
          })),
        }),
      )
    }

    const message = representData.join('\n').trim() || ''

    return {
      message,
    }
  },
})

const stepFourSchema = z.object({
  response: z.string().optional(),
  message: z.string(),
  error: z.string().optional(),
})

type StepFourOutput = z.infer<typeof stepFourSchema>

const stepFour = new Step({
  id: 'send-to-discord',
  outputSchema: stepFourSchema,
  execute: async ({ context }) => {
    try {
      if (context.steps['compose-message']?.status !== 'success') {
        throw new Error('Invalid compose message')
      }
      const message = context.steps['compose-message']?.output.message

      const resp = await discordClient.sendMessageToChannel({
        channelId: DISCORD_CHANNEL_ID,
        embed: {
          title: `🤖 Daily report (${formatDate(new Date(), 'MMMM d, yyyy')})`,
          description: message,
          color: 15158332,
          footer: {
            text: `${GITHUB_OWNER}/${GITHUB_REPO}`,
          },
        },
      })
      return {
        response: resp,
        message: 'success',
      }
    } catch (error) {
      return {
        message: 'Failed to send PR list to Discord',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

const stepFive = new Step({
  id: 'log-event',
  execute: async ({ context }) => {
    const { response, message, error } = (
      context.steps['send-to-discord'] as any
    )?.output as StepFourOutput
    const { todayPRs } = (context.steps['get-today-pr-list'] as any)
      ?.output as StepOneOutput
    const { todayCommits } = (context.steps['get-today-commits'] as any)
      ?.output as StepTwoOutput
    const { message: composeMessage } = (
      context.steps['compose-message'] as any
    )?.output as StepThreeOutput
    const ctxId = nanoid()

    await EventRepository.logEvent({
      workflowId: 'sendTodayPRListToDiscordWorkflow',
      eventCategory: EventCategory.NOTIFICATION_DISCORD,
      eventType: EventType.REPORT_PR_LIST,
      organizationId: GITHUB_OWNER!,
      repositoryId: GITHUB_REPO,
      eventData: {
        notificationType: NotificationType.DAILY_REPORT,
        message: composeMessage,
        prList: todayPRs,
        commitList: todayCommits,
        discordChannelId: DISCORD_CHANNEL_ID,
      },
      metadata: {
        response,
        message,
        error,
      },
      contextId: ctxId,
      tags: ['daily-report', 'github', 'pr-list', 'commit-list', 'discord'],
    })
    return context
  },
})

const sendTodayPRListToDiscordWorkflow = new Workflow({
  name: 'Send daily PR List to Discord',
})
  .step(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)

sendTodayPRListToDiscordWorkflow.commit()

export { sendTodayPRListToDiscordWorkflow }
