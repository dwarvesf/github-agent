import {
  ActionRowBuilder,
  ApplicationCommandData,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionsString,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { RateLimiter } from 'discord.js-rate-limiter'

import { Language } from '../../models/enum-helpers/index.js'
import { EventData } from '../../models/internal-models.js'
import { Lang } from '../../services/index.js'
import { InteractionUtils } from '../../utils/index.js'
import { Command, CommandDeferType } from '../index.js'

export class AccessKeyCommand implements Command {
  public names = [Lang.getRef('chatCommands.accessKey', Language.Default)]
  public cooldown = new RateLimiter(1, 10000)
  public deferType = CommandDeferType.NONE // Change to NONE since we're showing a modal
  public requireClientPerms: PermissionsString[] = ['ManageRoles']

  public metadata: ApplicationCommandData = {
    name: 'accesskey',
    description: '🔐 Enter an access key to gain entry to private channels',
    type: ApplicationCommandType.ChatInput,
  }

  public async execute(
    intr: ChatInputCommandInteraction,
    data: EventData,
  ): Promise<void> {
    // Create a modal for secure input
    const modal = new ModalBuilder()
      .setCustomId('access-key-modal')
      .setTitle('🔐 Private Channel Access')

    // Add input field for the access key
    const keyInput = new TextInputBuilder()
      .setCustomId('access-key-input')
      .setLabel('Enter your access key')
      .setPlaceholder('Enter the key provided to you')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(4)
      .setMaxLength(200)

    // Add the input to the modal
    const firstActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(keyInput)
    modal.addComponents(firstActionRow)

    // Show the modal to the user
    await intr.showModal(modal)

    // The handling of the modal submission should be done elsewhere
    // For example, in your interaction-handler.ts or a similar file
    // DO NOT try to handle it here directly with awaitModalSubmit
  }
}
