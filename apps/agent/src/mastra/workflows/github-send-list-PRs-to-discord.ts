import { Step, Workflow } from '@mastra/core/workflows';
import { getPRListTool } from '../tools';
import * as z from 'zod';
import { discordClient } from '../../lib/discord';

const sendPRListToDiscordWorkflow = new Workflow({
  name: 'Send PR List to Discord',
})
  .step(getPRListTool)
  .then(
    new Step({
      id: 'send-to-discord',
      description: 'Send PR list to Discord',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ context }) => {
        const output = context?.getStepResult<{ list: any }>(getPRListTool.id);
        const response = await discordClient.sendMessageToChannel({
          channelId: '1348951204419604483',
          message: JSON.stringify(output?.list, null, 2),
        });

        return response;
      },
    }),
  );

sendPRListToDiscordWorkflow.commit();

export { sendPRListToDiscordWorkflow };
