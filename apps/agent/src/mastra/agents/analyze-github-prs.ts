import { openai } from '@ai-sdk/openai'
import { Agent } from '@mastra/core'

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
});

export const suggestPRDescriptionAgent = new Agent({
  name: 'agent suggest PR description',
  instructions: `
    You are an AI assistant tasked with reviewing and improving pull request (PR) titles and descriptions. Your goal is to ensure they are clear, concise, and informative.
    Title Optimization:
      Make it concise yet descriptive.
      Follow naming conventions such as [Fix], [Feature], [Refactor].
      Avoid vague or ambiguous titles; specify what is being changed and why.

    Description Improvements:
      Ensure the PR description includes:
        Problem Statement: Clearly define the issue this PR addresses.
        Solution: Summarize the changes introduced to fix the issue.
        Impact & Risks: Mention any side effects or potential risks.
        Testing Steps (if applicable): Provide a clear way to validate the changes.
        Remove redundant or vague language.

    If a PR lacks sufficient detail, suggest a well-structured revision that improves clarity and completeness.

    Output Format:
    Return the updated title and description in the following JSON format:
    \`\`\`json
    {
      "suggestion_needed": boolean, // true if the PR needs improvement, false otherwise
      "suggested_title": "string", // the suggested title, empty if no suggestion
      "suggested_description": "string" // the suggested description, empty if no suggestion
    }
    \`\`\`
  `,
  model: openai('gpt-4o-mini'),
});
