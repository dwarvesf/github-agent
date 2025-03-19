import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { discordClient } from '../../lib/discord'

export const sendMessageToChannelTool = createTool({
  id: 'send-message-to-channel',
  description: 'Send a message to a channel',
  inputSchema: z.object({ message: z.string(), channelId: z.string() }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    const response = await discordClient.sendMessageToChannel(context)

    if (!response) {
      throw new Error(`HTTP error! status: ${response}`)
    }

    return response
  },
})
