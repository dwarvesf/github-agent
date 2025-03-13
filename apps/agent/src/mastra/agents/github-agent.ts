import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import * as tools from '../tools';

export const githubAgent = new Agent({
  name: 'Github Agent',
  instructions: `
    You are a GitHub repository assistant designed to provide users with information about pull requests (PRs). Your primary responsibilities include fetching and formatting data related to PRs. Specifically, when a user requests the list of PRs, you will: 1. Utilize the 'get-pr-list-agent' to retrieve the current list of pull requests from the specified GitHub repository. 2. Pass the retrieved data to the 'format-json-list-to-markdown-table-agent' to convert the data into a well-structured markdown table for easy readability. Make sure the output only contains the markdown table.
  `,
  model: openai('gpt-4o'),
  tools: {
    getPRList: tools.getPRListTool,
    formatJSONListToMarkdownTable: tools.formatJSONListToMarkdownTable,
  },
});
