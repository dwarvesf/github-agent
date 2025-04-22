import { EventData } from '../db'
import { PullRequest } from './type'

export interface NotificationEmbed {
  title: string
  color: number
  description?: string
  fields?: Array<{
    name: string
    value: string
    inline: boolean
  }>
  footer?: {
    text: string
  }
  inline?: boolean
}

export interface NotificationTemplate {
  title: string | ((count: number) => string)
  color: number
  description?: string
  footer?: {
    text: string
  }
}

export class NotificationEmbedBuilder {
  private static readonly DISCORD_FIELD_LIMIT = 1024

  static createEmbed(
    input: NonNullable<EventData['repositoriesPRs']>,
    template: NotificationTemplate,
    includeDate?: boolean,
  ): NotificationEmbed {
    const fields: NotificationEmbed['fields'] = []

    for (const { repositoryId, prList } of input) {
      const formattedPRs = this.formatPRList(
        prList as PullRequest[],
        includeDate,
      )
      const title = `\`${repositoryId}\``
      const chunks = this.splitIntoChunks([title, formattedPRs].join('\n'))

      chunks.forEach((chunk) => {
        fields.push({
          name: '',
          value: chunk,
          inline: false,
        })
      })
    }

    const embed: NotificationEmbed = {
      title:
        typeof template.title === 'function'
          ? template.title(input.flatMap((item) => item.prList).length)
          : template.title,
      color: template.color,
      fields,
    }

    if (template.description) {
      embed.description = template.description
    }

    if (template.footer) {
      embed.footer = template.footer
    }

    return embed
  }

  private static formatPRList(
    prs: PullRequest[],
    includeDate: boolean = false,
  ): string {
    return prs
      .map((pr) =>
        includeDate
          ? `∟ [#${pr.number}](${pr.url}) | ${pr.title} | Created at: ${
              new Date(pr.createdAt).toISOString().split('T')[0]
            }`
          : `∟ [#${pr.number}](${pr.url}) | ${pr.title}`,
      )
      .join('\n')
  }

  private static splitIntoChunks(text: string): string[] {
    const chunks: string[] = []
    const lines = text.split('\n')
    let currentChunk = ''

    for (const line of lines) {
      const potentialChunk = currentChunk ? `${currentChunk}\n${line}` : line

      if (potentialChunk.length <= this.DISCORD_FIELD_LIMIT) {
        currentChunk = potentialChunk
      } else {
        if (currentChunk) chunks.push(currentChunk)
        currentChunk = line
      }
    }

    if (currentChunk) chunks.push(currentChunk)
    return chunks
  }
}
