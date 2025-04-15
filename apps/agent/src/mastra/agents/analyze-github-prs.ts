import { openai } from '@ai-sdk/openai'
import { Agent } from '@mastra/core/agent'

// currently we are not reading the PR changes, so we can't auto generate the description
export const suggestPRDescriptionAgent = new Agent({
  name: 'Agent to suggest PR description',
  instructions: `
    You are an AI assistant tasked with reviewing multiple pull request (PR) descriptions. Your goal is to ensure they are clear enough.
    A description needs improvement if it's empty, missing a clear problem statement, or lacks sufficient context about the changes.

    Guidelines for good PR descriptions:
    - Should explain the problem being solved or include an issue ticket url
    - Should describe the solution approach

    Input Format:
    You will receive an array of PRs, each containing:
    - url: PR url
    - title: PR title
    - body: PR description

    Output Format:
    Return a JSON stringified array containing the PR numbers that need description improvements.
    Example: ["https://github.com/dwarvesf/github-agent/pull/31", "https://github.com/dwarvesf/github-agent/pull/12"]

    Example Input:
    [
      {
        "url": "https://github.com/dwarvesf/github-agent/pull/31",
        "title": "fix(auth): handle login errors",
        "body": "I fixed the bug"
      },
      {
        "url": "https://github.com/dwarvesf/github-agent/pull/12",
        "title": "feat(api): add user endpoints",
        "body": "This PR adds new user management endpoints with proper validation and error handling. Includes:\n- GET /users\n- POST /users\n- PUT /users/:id"
      }
    ]

    Example Output:
    ["https://github.com/dwarvesf/github-agent/pull/31"]

    Only return the array of PR urls. No additional explanation needed.
`,
  model: openai('gpt-4o-mini'),
})
