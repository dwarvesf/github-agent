import { Step, Workflow } from '@mastra/core/workflows'
import { getOrgOpenPRsTool, prsSchema } from '../tools/github'
import { z } from 'zod'
import { analyzePRsAgent } from '../agents'

const analyzePRs = new Step({
  id: 'analyze-prs',
  description:
    'Analyze pull requests and determine if they are ready for review',
  inputSchema: prsSchema,
  execute: async ({ context }) => {
    const prs =
      context?.getStepResult<z.infer<typeof prsSchema>>('get-org-open-prs')

    if (!prs || prs.length === 0) {
      throw new Error('PRs data not found')
    }

    console.log('>>>', 'prs', JSON.stringify(prs, null, 2))
    const prompt = `Based on the following pull requests, help me determine if they need to be notified:
    ${JSON.stringify(prs, null, 2)}
    `

    const response = await analyzePRsAgent.generate([
      {
        role: 'user',
        content: prompt,
      },
    ])
    console.log('>>>', 'response', response)

    return {
      prs: response.text,
    }
  },
})

const notifyDeveloperPRRequestWorkflow = new Workflow({
  name: 'Notify Developer PR Request',
})
  .step(getOrgOpenPRsTool)
  .then(analyzePRs)

notifyDeveloperPRRequestWorkflow.commit()

export { notifyDeveloperPRRequestWorkflow }
