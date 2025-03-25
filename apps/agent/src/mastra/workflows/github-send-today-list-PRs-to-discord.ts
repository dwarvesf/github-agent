import { Step, Workflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { DISCORD_CHANNEL_ID, discordClient } from '../../lib/discord'
import { GITHUB_OWNER, GITHUB_REPO, githubClient } from '../../lib/github'
import {
  convertArrayToMarkdownTableList,
  convertNestedArrayToTreeList,
} from '../../utils/string'
import { formatDate } from '../../utils/datetime'

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
        message: commit.commit.message,
      })),
    }
  },
})

const stepThree = new Step({
  id: 'compose-message',
  execute: async ({ context }) => {
    if (
      context.steps['get-today-pr-list']?.status === 'success' &&
      context.steps['get-today-commits']?.status === 'success'
    ) {
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

      const message = representData.join('\n').trim()

      return {
        message,
      }
    }
  },
})

const stepFour = new Step({
  id: 'send-to-discord',
  execute: async ({ context }) => {
    if (context.steps['compose-message']?.status === 'success') {
      const message = context.steps['compose-message']?.output.message

      return await discordClient.sendMessageToChannel({
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
    }
  },
})
const sendTodayPRListToDiscordWorkflow = new Workflow({
  name: 'Send daily PR List to Discord',
})
  .step(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)

sendTodayPRListToDiscordWorkflow.commit()

export { sendTodayPRListToDiscordWorkflow }
