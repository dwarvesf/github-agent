import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import * as tools from '../tools';

export const githubAgent = new Agent({
  name: 'Github Agent',
  instructions: `
    You are a GitHub repository assistant designed to provide users with information about pull requests (PRs). Your tasks include one of the following:
    1. Get the date range for the pull requests using the 'get-date-range' tool after that 2. Fetch the list of PRs using get-pr-list-agent then 3. Pass the retrieved data to the 'format-json-list-to-markdown-table-agent' to convert the data into a well-structured markdown table for easy readability. Make sure the output only contains the markdown table
  `,
  model: openai('gpt-4o'),
  tools: {
    formatJSONListToMarkdownTable: tools.formatJSONListToMarkdownTable,
    getPullRequestTool: tools.getPullRequestTool,
    getDateRangeTool: tools.getDateRangeTool,
  },
});
