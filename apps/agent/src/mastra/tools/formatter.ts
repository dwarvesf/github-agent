import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import {
  convertNestedArrayToTreeList,
  escapeSpecialCharactersForMarkdown,
} from '../../utils/string'
import { CommitsToolOutputSchema, PRListOutputSchema } from './github'
import { MemberRepository } from '../../db'
import { a } from 'vitest/dist/chunks/suite.d.FvehnV49.js'

export const formatCommitList = createTool({
  id: 'format-commits-to-markdown-list-agent',
  description: 'format a list of commits to markdown format',
  inputSchema: z.object({
    list: z.string().describe('JSON list'),
    platform: z.enum(['github', 'discord']).default('github').optional(),
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
          label: `[\`${commit.sha}\`](${commit.url}) ${escapeSpecialCharactersForMarkdown(commit.message)} by ${convertAuthorTag(commit, context.platform)}`,
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
    platform: z.enum(['github', 'discord']).default('github').optional(),
  }),
  outputSchema: z.object({
    markdown: z.string().describe('Markdown pull request list'),
  }),
  execute: async ({ context }) => {
    let list: PRListOutputSchema['list'] = []
    try {
      list = JSON.parse(context.list) ?? []
    } catch (e) {
      console.error('Failed to parse pull request list:', e)
      return {
        markdown: 'Error: Failed to parse pull request list',
      }
    }

    if (list.length === 0) {
      return {
        markdown: 'No pull requests found!',
      }
    }

    return {
      markdown: convertNestedArrayToTreeList({
        label: '`Pull requests:`',
        children: list.map((pr) => ({
          label: `[\`#${pr.number}\`](${pr.url}) ${escapeSpecialCharactersForMarkdown(pr.title)} by ${convertAuthorTag(pr, context.platform)}`,
        })),
      }),
    }
  },
})

export const mapPlatformIdToGithubIdTool = createTool({
  id: 'map-users-platform-to-github-id-tool',
  description: 'Map users platform ID to Github ID',
  inputSchema: z.object({
    id: z.string().describe('platform id'),
    platform: z.enum(['github', 'discord']).default('github').optional(),
  }),
  outputSchema: z.object({
    githubId: z.string().optional(),
  }),
  execute: async ({ context }) => {
    if (context.platform === 'github') {
      return {
        githubId: context.id,
      }
    }

    const members = await MemberRepository.list({
      where: {
        platformId: context.id,
        platformType: context.platform,
      },
    })

    for (const member of members) {
      if (member.platformId && context.id == member.platformId) {
        return {
          githubId: member.githubId,
        }
      }
    }

    return {
      githubId: undefined,
    }
  },
})

function convertAuthorTag(
  info: {
    author: string
    authorDiscordId?: string
  },
  platform: 'discord' | 'github' | undefined,
): string {
  switch (platform) {
    case 'discord':
      return info.authorDiscordId
        ? `<@${info.authorDiscordId}>`
        : `@${info.author}`
    default:
      return `@${info.author}`
  }
}
