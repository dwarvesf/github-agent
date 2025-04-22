import type { APIEmbed, Channel, DMChannel } from 'discord.js'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  Message,
  MessageComponentInteraction,
} from 'discord.js'
import { DiscordLimits } from '../constants/discord-limits.js'

// Constants
const COLLECTOR_TIMEOUT = 300000 // 5 minutes

export interface PaginationOptions {
  itemsPerPage?: number
  currentPage?: number
  maxPages?: number
}

export interface PaginatedResult<T> {
  items: T[]
  totalPages: number
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PaginationButtonOptions {
  style?: ButtonStyle
  useEmoji?: boolean
  prevLabel?: string
  nextLabel?: string
  prevEmoji?: string
  nextEmoji?: string
}

export interface CollectorOptions {
  time?: number
  message?: string
}

interface PaginationState {
  currentPage: number
  totalPages: number
}

export class PaginationUtils {
  private static readonly DEFAULT_BUTTON_OPTIONS: PaginationButtonOptions = {
    style: ButtonStyle.Secondary,
    useEmoji: false,
    prevLabel: 'Previous',
    nextLabel: 'Next',
    prevEmoji: '◀️',
    nextEmoji: '▶️',
  }

  private static readonly DEFAULT_COLLECTOR_OPTIONS: CollectorOptions = {
    time: COLLECTOR_TIMEOUT,
    message: 'Only the command user can navigate these pages.',
  }

  /**
   * Creates a paginated result from an array of items
   * @param items Array of items to paginate
   * @param options Pagination options
   * @returns Paginated result containing items for the current page and pagination info
   */
  public static paginate<T>(
    items: T[],
    options: PaginationOptions = {},
  ): PaginatedResult<T> {
    const itemsPerPage = options.itemsPerPage ?? DiscordLimits.FIELDS_PER_EMBED
    const currentPage = Math.max(1, options.currentPage ?? 1)
    const maxPages = options.maxPages ?? Math.ceil(items.length / itemsPerPage)

    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, items.length)

    const paginatedItems = items.slice(startIndex, endIndex)
    const totalPages = Math.min(
      maxPages,
      Math.ceil(items.length / itemsPerPage),
    )

    return {
      items: paginatedItems,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    }
  }

  /**
   * Gets pagination action row components based on pagination state
   */
  private static getPaginationComponents(
    result: PaginatedResult<unknown>,
    options: PaginationButtonOptions = PaginationUtils.DEFAULT_BUTTON_OPTIONS,
  ) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setStyle(options.style ?? ButtonStyle.Secondary)
        .setDisabled(!result.hasPreviousPage),
      new ButtonBuilder()
        .setCustomId('next')
        .setStyle(options.style ?? ButtonStyle.Secondary)
        .setDisabled(!result.hasNextPage),
    )

    // Set labels based on options
    if (options.useEmoji) {
      row.components[0].setLabel(options.prevEmoji ?? '◀️')
      row.components[1].setLabel(options.nextEmoji ?? '▶️')
    } else {
      row.components[0].setLabel(options.prevLabel ?? 'Previous')
      row.components[1].setLabel(options.nextLabel ?? 'Next')
    }

    return [row]
  }

  /**
   * Sets up pagination for interaction-based commands
   * @param interaction The original command interaction
   * @param pages Array of embeds to paginate through
   * @param buttonOptions Options for pagination buttons
   * @param collectorOptions Options for the button collector
   */
  private static createInitialState(totalPages: number): PaginationState {
    return {
      currentPage: 0,
      totalPages,
    }
  }

  private static createPaginationResult(
    state: PaginationState,
  ): PaginatedResult<unknown> {
    return {
      items: [], // Not used for this case
      totalPages: state.totalPages,
      currentPage: state.currentPage + 1,
      hasNextPage: state.currentPage < state.totalPages - 1,
      hasPreviousPage: state.currentPage > 0,
    }
  }

  private static updatePageNumber(
    currentPage: number,
    direction: 'prev' | 'next',
    totalPages: number,
  ): number {
    if (direction === 'prev') {
      return Math.max(0, currentPage - 1)
    }
    return Math.min(totalPages - 1, currentPage + 1)
  }

  private static async handleCollectorEnd(
    message: Message,
    currentPage: number,
    pages: APIEmbed[],
  ): Promise<void> {
    await message.edit({
      embeds: [pages[currentPage]],
      components: [],
    })
  }

  public static async handleInteractionPagination(
    interaction: ChatInputCommandInteraction,
    pages: APIEmbed[],
    buttonOptions: PaginationButtonOptions = PaginationUtils.DEFAULT_BUTTON_OPTIONS,
    collectorOptions: CollectorOptions = PaginationUtils.DEFAULT_COLLECTOR_OPTIONS,
  ): Promise<void> {
    if (pages.length === 0) return

    const state = PaginationUtils.createInitialState(pages.length)
    const result = PaginationUtils.createPaginationResult(state)

    // Send initial message with first page
    const reply = await interaction.editReply({
      embeds: [pages[state.currentPage]],
      components:
        pages.length > 1
          ? PaginationUtils.getPaginationComponents(result, buttonOptions)
          : [],
    })

    if (pages.length <= 1) return

    // Create button collector
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: collectorOptions.time,
    })

    collector.on('collect', async (i: MessageComponentInteraction) => {
      // Check if the interaction is from the original user
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: collectorOptions.message,
          ephemeral: true,
        })
        return
      }

      state.currentPage = PaginationUtils.updatePageNumber(
        state.currentPage,
        i.customId as 'prev' | 'next',
        pages.length,
      )

      const newResult = PaginationUtils.createPaginationResult(state)

      // Update message with new page and buttons
      await i.update({
        embeds: [pages[state.currentPage]],
        components: PaginationUtils.getPaginationComponents(
          newResult,
          buttonOptions,
        ),
      })
    })

    collector.on('end', async () => {
      if (reply instanceof Message) {
        await PaginationUtils.handleCollectorEnd(
          reply,
          state.currentPage,
          pages,
        )
      }
    })
  }

  /**
   * Sets up pagination collector for interactive message navigation
   */
  public static async setupWebhookPaginationCollector(
    channel: DMChannel | Channel,
    embeds: APIEmbed[],
    content?: string,
  ): Promise<void> {
    if (!('send' in channel)) {
      return
    }

    const state = PaginationUtils.createInitialState(embeds.length)
    const result = PaginationUtils.createPaginationResult(state)

    const webhookButtonOptions: PaginationButtonOptions = {
      style: ButtonStyle.Secondary,
      useEmoji: true,
    }

    // Send initial message with first page
    const message = await channel.send({
      content,
      embeds: [embeds[state.currentPage]],
      components:
        embeds.length > 1
          ? PaginationUtils.getPaginationComponents(
              result,
              webhookButtonOptions,
            )
          : [],
    })

    // Create button collector
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_TIMEOUT,
    })

    collector.on('collect', async (i: MessageComponentInteraction) => {
      state.currentPage = PaginationUtils.updatePageNumber(
        state.currentPage,
        i.customId as 'prev' | 'next',
        embeds.length,
      )

      const newResult = PaginationUtils.createPaginationResult(state)

      // Update message with new page
      await i.update({
        content,
        embeds: [embeds[state.currentPage]],
        components: PaginationUtils.getPaginationComponents(
          newResult,
          webhookButtonOptions,
        ),
      })
    })

    collector.on('end', async () => {
      if (message instanceof Message) {
        await PaginationUtils.handleCollectorEnd(
          message,
          state.currentPage,
          embeds,
        )
      }
    })
  }
}
