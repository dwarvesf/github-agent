import { createTool } from '@mastra/core/tools'
import * as z from 'zod'

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
