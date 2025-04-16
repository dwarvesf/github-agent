import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { CommitsToolOutputSchema, PRListOutputSchema } from './github'
import {
  convertNestedArrayToTreeList,
  escapeSpecialCharactersForMarkdown,
} from '../../utils/string'
import { githubIdMapper } from '../../lib/id-mapper'

export const formatCommitList = createTool({
  id: 'format-commits-to-markdown-list-agent',
  description: 'format a list of commits to markdown format',
  inputSchema: z.object({
    list: z.string().describe('JSON list'),
  }),
  outputSchema: z.object({
    markdown: z.string().describe('Markdown commit list'),
  }),
  execute: async ({ context }) => {
    const list = (JSON.parse(context.list) ??
      []) as CommitsToolOutputSchema['list']

    if (list.length === 0) {
      return {
        markdown: 'No commits found!',
      }
    }

    return {
      markdown: convertNestedArrayToTreeList({
        label: '`Commits:`',
        children: list.map((commit) => ({
          label: `[\`${commit.sha}\`](${commit.url}) ${escapeSpecialCharactersForMarkdown(commit.message)} by @${commit.author}`,
        })),
      }),
    }
  },
})

export const formatPullRequestList = createTool({
  id: 'format-pull-requests-to-markdown-list-agent',
  description: 'format a list of pull requests to markdown format',
  inputSchema: z.object({
    list: z.string().describe('JSON list'),
  }),
  outputSchema: z.object({
    markdown: z.string().describe('Markdown pull request list'),
  }),
  execute: async ({ context }) => {
    let list: PRListOutputSchema['list'] = []
    try {
      list = JSON.parse(context.list) ?? []
    } catch (e) {}

    if (list.length === 0) {
      return {
        markdown: 'No pull requests found!',
      }
    }

    return {
      markdown: convertNestedArrayToTreeList({
        label: '`Pull requests:`',
        children: list.map((pr) => ({
          label: `[\`#${pr.number}\`](${pr.url}) ${escapeSpecialCharactersForMarkdown(pr.title)} by @${pr.author}`,
        })),
      }),
    }
  },
})

export const mapGithubIdsToDiscordIdsTool = createTool({
  id: 'map-users-github-to-discord-id-tool',
  description: 'Map users Github ID to Discord ID',
  inputSchema: z.object({
    message: z.string().describe('Message Content'),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const githubIdToDiscordIdMapping = githubIdMapper.getDiscordIdMapping()

    const message = context.message.replaceAll(
      /@([a-zA-Z0-9_-]+)/g,
      (match, githubId) => {
        const discordId = githubIdToDiscordIdMapping.find(
          (mapping) => mapping.githubId === githubId,
        )?.discordId
        if (discordId) {
          return `<@!${discordId}>`
        }
        return match
      },
    )

    return {
      message: message,
    }
  },
})

export const mapDiscordIdsToGithubIdsTool = createTool({
  id: 'map-users-discord-to-github-id-tool',
  description: 'Map users Discord ID to Github ID',
  inputSchema: z.object({
    message: z.string().describe('Message Content'),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const githubIdToDiscordIdMapping = githubIdMapper.getDiscordIdMapping()

    const message = context.message.replaceAll(
      /<@!?(\d+)>/g,
      (match, discordId) => {
        const githubId = githubIdToDiscordIdMapping.find(
          (mapping) => mapping.discordId === discordId,
        )?.githubId
        return githubId || match
      },
    )

    return {
      message: message,
    }
  },
})
