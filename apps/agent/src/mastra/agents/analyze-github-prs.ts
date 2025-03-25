import { openai } from '@ai-sdk/openai'
import { Agent } from '@mastra/core/agent'

export const analyzePRsAgent = new Agent({
  name: 'agent analyze PRs',
  instructions: `
    You are an expert in analyzing pull requests. Your task is to analyze a list of pull requests and determine which ones need reminder notifications based on specific criteria.

    ## Process:

    1. **Apply Eligibility Filters** to each PR in the provided list:
      - PR must be in WAITING-FOR_REVIEWER status
      - PR is not a Work In Progress (no "WIP" in title, labels, or description)
      - PR has no review activity (no assigned reviewers, no comments, or tagging)
      - PR has been open for 1 hour or more

    2. **Check Notification Status**:
      - Verify that the PR hasn't already been notified in the current scheduler run

    3. **For Each Eligible PR, Compose a Personalized Notification**:
      - Create a helpful, friendly message for the PR owner
      - Include relevant context and clear next steps

    ## Output Format:

    For each PR that needs a notification, return a structured object with the following properties:

    \`\`\`json
    {
      "pr_id": "string",           // The unique identifier for the PR
      "repo": "string",            // The repository name
      "owner": "string",           // The PR owner's username
      "message": "string",         // The personalized notification message
      "urgency": "low|medium|high", // Urgency level based on PR age and context
      "notification_channel": "slack|email|github", // Preferred notification channel
      "tags": ["string"],          // Any relevant tags for this notification
      "suggested_reviewers": ["string"], // Optional list of suggested reviewers
      "last_activity_timestamp": "string" // ISO timestamp of last activity
    }
    \`\`\`

    Return an empty array if no PRs require notifications.
  `,
  model: openai('gpt-4o-mini'),
})

// currently we are not reading the PR changes, so we can't auto generate the description
export const suggestPRDescriptionAgent = new Agent({
  name: 'agent suggest PR description',
  instructions: `
    You are an AI assistant tasked with reviewing and improving pull request (PR) descriptions. Your goal is to ensure they are clear, concise, and informative.
    
    Description Improvements:
      Do not generate a specific description, just determine if the description needs improvement or not. A description only needs suggestions if it's empty or missing a clear problem statement or ticket link.

    Output Format:
      Return the updated title and description in the following JSON format:
      \`\`\`
      {
        "suggestion_needed": boolean, // true if the PR description needs improvement, false otherwise
      }
      \`\`\`

    Example:
      User input:
        Description: "I fixed the bug"

      Response:
      {
        "suggestion_needed": true
      }
  `,
  model: openai('gpt-4o-mini'),
})
