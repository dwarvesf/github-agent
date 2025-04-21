import {
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionsString,
} from 'discord.js'

import { EventData } from '../../models/internal-models.js'
import { Language } from '../../models/enum-helpers/index.js'
import { Lang } from '../../services/index.js'
import { InteractionUtils, PaginationUtils } from '../../utils/index.js'
import {
  Command,
  CommandDeferType,
  processResponseToEmbedFields,
} from '../index.js'
import dotenv from 'dotenv'
dotenv.config()

export class AskCommand implements Command {
  public names = [Lang.getRef('chatCommands.ask', Language.Default)]
  public deferType = CommandDeferType.PUBLIC
  public requireClientPerms: PermissionsString[] = []
  public async execute(
    intr: ChatInputCommandInteraction,
    data: EventData,
  ): Promise<void> {
    const args = {
      prompt: intr.options.getString(
        Lang.getRef('arguments.promptText', Language.Default),
      ),
    }

    if (args.prompt) {
      await this.handlePrompt(intr, data)
      return
    }
  }

  private async handlePrompt(
    intr: ChatInputCommandInteraction,
    data: EventData,
  ): Promise<void> {
    // Get the full message content after the command
    const question = intr.toString().replace('/ask prompt:', '').trim()

    if (!question) {
      await InteractionUtils.send(
        intr,
        Lang.getEmbed('errorEmbeds.missingPrompt', data.lang),
      )
      return
    }

    // Start with an empty response message
    await InteractionUtils.send(
      intr,
      Lang.getEmbed('displayEmbeds.askResponse', data.lang, {
        RESPONSE: '...',
        USER: intr.user.id,
      }).addFields([
        {
          name: '',
          value: `**Question**: ${formatQuestionWithUserMention(question)}\n`,
        },
        {
          name: '',
          value: "I'm looking for the answer...",
        },
      ]),
    )

    let response = ''
    try {
      // Process the stream
      for await (const chunk of getStreamedResponse(
        intr.user.id,
        question,
        intr.channel?.isDMBased?.() ? undefined : intr.channelId,
      )) {
        response += chunk
      }

      const processedResponse = await processResponseToEmbedFields(
        intr.client,
        intr.guildId,
        `${response}`,
      )

      const questionField = {
        name: '',
        value: `**Question**: ${formatQuestionWithUserMention(question)}\n`,
        inline: false,
      }

      const embeds = processedResponse.map((fields, index) => {
        const embed = Lang.getEmbed('displayEmbeds.askResponse', data.lang, {
          USER: intr.user.id,
        }).setColor(5737479)

        embed.addFields([
          questionField,
          ...fields,
          {
            name: '',
            value:
              '-# 📸 Snapshot taken at ' +
              new Date().toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
          },
        ])

        if (processedResponse.length > 1) {
          embed.setFooter({
            text: `Page ${index + 1}/${processedResponse.length}`,
          })
        }

        return embed
      })

      if (embeds.length > 1) {
        // Convert EmbedBuilder[] to APIEmbed[] and add pagination
        await PaginationUtils.handleInteractionPagination(
          intr,
          embeds.map((embed) => embed.toJSON()),
          {
            useEmoji: true,
            prevEmoji: '◀️',
            nextEmoji: '▶️',
            style: ButtonStyle.Secondary,
          },
        )
      } else {
        // If there's only one embed, just edit the original message
        await InteractionUtils.editReply(intr, embeds[0])
      }
    } catch (error) {
      console.error('Error processing streamed response:', error)
      await InteractionUtils.editReply(
        intr,
        Lang.getEmbed('errorEmbeds.streamingError', data.lang, {
          ERROR: error.message || 'Unknown error occurred',
        }),
      )
    }
  }
}

async function* getStreamedResponse(
  discordUserId: string,
  question: string,
  channelId?: string,
): AsyncGenerator<string, void, unknown> {
  const AGENT_STREAM_URL = process.env.AGENT_STREAM_URL

  if (!AGENT_STREAM_URL) {
    console.error('AGENT_STREAM_URL is not defined in environment variables')
    yield 'Error: API endpoint not configured properly. Please contact an administrator.'
    return
  }

  try {
    const response = await fetch(AGENT_STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: channelId
              ? `I am <@${discordUserId}> in channel ${channelId}`
              : `I am <@${discordUserId}>`,
          },
          { role: 'user', content: question },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    // Process the stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalResponse = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines from the buffer
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim() === '') continue

        try {
          // Parse the line based on the prefix
          if (line.startsWith('0:')) {
            // Content chunk - extract the content
            const content = line.substring(2)
            // Remove quotes if present
            const cleanContent =
              content.startsWith('"') && content.endsWith('"')
                ? JSON.parse(content)
                : content

            finalResponse += cleanContent
            yield cleanContent
          }
          // Tool call response handling
          else if (line.startsWith('a:')) {
            // This is a tool call result, might need to process it if needed
            // For now, we'll just continue with the stream
            continue
          }
          // Handle initialization (f:) and end markers (e:, d:)
          else if (line.startsWith('e:') || line.startsWith('d:')) {
            // End of stream reached
            // We can optionally process any finish data here
            continue
          } else if (line.startsWith('9:')) {
            // Tool call request, we can ignore this for now
            continue
          } else if (line.startsWith('f:')) {
            // Message ID initialization, we can ignore this
            continue
          }
          // Ignore other prefixes we don't understand
        } catch (err) {
          console.error('Error processing line:', err, line)
          // Continue processing other lines
        }
      }
    }
  } catch (error) {
    console.error('Error in streaming response:', error)
    yield `Error: ${error.message || 'Failed to get response'}`
    throw error
  }
}

function formatQuestionWithUserMention(question: string): string {
  return `\` ${question.replace(/(<@?\d+>)/g, '`$1`')} \``
}
