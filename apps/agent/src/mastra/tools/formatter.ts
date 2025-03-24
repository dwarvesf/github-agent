import { createTool } from '@mastra/core/tools'
import * as z from 'zod'
import { CommitsToolOutputSchema, PRListOutputSchema } from './github'
import {
  convertNestedArrayToTreeList,
  escapeSpecialCharactersForMarkdown,
} from '../../utils/string'

function jsonToMarkdownTable(jsonArray: any[]): string {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    return 'No data available'
  }

  // Extract column names (keys from the first object)
  const columns = Object.keys(jsonArray[0])

  // Create the header row
  const header = `| ${columns.join(' | ')} |`

  // Create the separator row
  const separator = `| ${columns.map(() => '---').join(' | ')} |`

  // Create the data rows
  const rows = jsonArray.map((row) => {
    return `| ${columns.map((col) => row[col] ?? '').join(' | ')} |`
  })

  // Combine all parts
  return [header, separator, ...rows].join('\n')
}

export const formatJSONListToMarkdownTable = createTool({
  id: 'format-json-list-to-markdown-table-agent',
  description:
    'calls the JSON-Table-Markdown-Formatter agent to format a JSON list to a markdown table',
  inputSchema: z.object({
    list: z.string().describe('JSON list'),
  }),
  outputSchema: z.object({
    markdown: z.string().describe('Edited markdown table'),
  }),
  execute: async ({ context }) => {
    const markdown = jsonToMarkdownTable(JSON.parse(context.list))

    return {
      markdown: markdown,
    }
  },
})

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
