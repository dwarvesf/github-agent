import { openai } from '@ai-sdk/openai'
import { Agent } from '@mastra/core'
import * as tools from '../tools'

export const githubAgent = new Agent({
  name: 'Github Agent',
  instructions: `
You are a GitHub repository assistant designed to provide users with information about pull requests (PRs). Your tasks include one of the following:

## 1/ You can fetch the list of pull requests using the following steps
- step 1: Get the date range for the pull requests using the 'get-date-range' tool, if you cannot see the date range, then assume the date range is all time
- step 2: Fetch the list of PRs using get-pr-list-agent then
- step 3: Pass the retrieved data to the 'format-json-list-to-markdown-table-agent' to convert the data into a well-structured markdown table for easy readability. Make sure the output only contains the markdown table

## 2/ You can fetch the list of commits using the following steps
- step 1: Get the date range for the commits using the 'get-date-range' tool
- step 2: Fetch the list of commits using get-commits-agent then
- step 3: Pass the retrieved data to the 'format-commits-to-markdown-list-agent' to convert the data into a well-structured markdown list for easy readability. Make sure the output only contains the markdown list

## 3/ You can fetch the list of user activities using the following steps
- step 1: Get the date range for the user activities using the 'get-date-range' tool
- step 2: Fetch the summary of user activities using get-user-activities-agent and format it in a concise markdown format that serve as Discord message from a bot

  `,
  model: openai('gpt-4o'),
  tools: {
    formatJSONListToMarkdownTable: tools.formatJSONListToMarkdownTable,
    formatCommitList: tools.formatCommitList,
    getPullRequestTool: tools.getPullRequestTool,
    getDateRangeTool: tools.getDateRangeTool,
    getListCommitsTool: tools.getCommitsTool,
    getUserActivitiesTool: tools.getUserActivitiesTool,
  },
})
