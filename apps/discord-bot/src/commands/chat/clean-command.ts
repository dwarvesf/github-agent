import { CommandInteraction, Message, PermissionsString } from 'discord.js'
import { RateLimiter } from 'discord.js-rate-limiter'

import { Language } from '../../models/enum-helpers/language.js'
import { EventData } from '../../models/internal-models.js'
import { Lang } from '../../services/lang.js'
import { Command, CommandDeferType } from '../command.js'
import { InteractionUtils } from '../../utils/interaction-utils.js'
import { MessageUtils } from '../../utils/message-utils.js'

export class CleanCommand implements Command {
  public names = [Lang.getRef('chatCommands.clean', Language.Default)]
  public cooldown?: RateLimiter
  public deferType: CommandDeferType = CommandDeferType.HIDDEN
  public requireClientPerms: PermissionsString[] = ['ManageMessages']

  public async execute(
    intr: CommandInteraction,
    data: EventData,
  ): Promise<void> {
    try {
      if (!intr.isChatInputCommand()) {
        return
      }
      // Check if the user has the required permissions
      if (this.requireClientPerms.length > 0 && !intr.channel.isDMBased()) {
        const missingPermissions = this.requireClientPerms.filter(
          (perm) => !intr.memberPermissions.has(perm),
        )

        if (missingPermissions.length > 0) {
          await InteractionUtils.send(
            intr,
            `Must have ${this.requireClientPerms.join(', ')} permission(s) for removing messages!`,
            true,
          )
          return
        }
      }

      // Get the number of messages to clean from the options
      let amount = intr.options.getInteger('amount', true)

      // Validate the amount
      if (amount < 1 || amount > 100) {
        await InteractionUtils.send(
          intr,
          'Please provide a number between 1 and 100.',
          true,
        )
        return
      }

      // Start with an empty response message
      await InteractionUtils.send(
        intr,
        Lang.getEmbed('displayEmbeds.cleanResponse', data.lang, {
          RESPONSE: '...',
          USER: intr.user.id,
        }).addFields([
          {
            name: '',
            value: 'Checking the messages...',
          },
        ]),
        true,
      )

      const channelMsgs = await intr.channel.messages.fetch({ limit: amount })

      if (channelMsgs.size < amount) {
        amount = channelMsgs.size
      }

      const messagesToDelete: Message[] = []

      channelMsgs.forEach((msg) => {
        if (
          msg.author.id === intr.applicationId &&
          messagesToDelete.length < amount &&
          msg.deletable
        ) {
          messagesToDelete.push(msg)
        }
      })

      let msg = 'There is no messages to delete!'

      if (messagesToDelete.length) {
        // Delete messages
        if (intr.channel?.isDMBased()) {
          // In DMs, we need to delete messages one by one
          for (const message of messagesToDelete) {
            await MessageUtils.delete(message)
          }
        } else {
          // In guild channels, we can use bulk delete
          await intr.channel.bulkDelete(messagesToDelete, true)
        }

        msg = `Successfully deleted ${messagesToDelete.length} messages.`
      }

      await InteractionUtils.editReply(
        intr,
        Lang.getEmbed('displayEmbeds.cleanResponse', data.lang, {
          USER: intr.user.id,
        })
          .setColor(5737479)
          .addFields([
            {
              name: '',
              value: msg,
            },
          ]),
      )
    } catch (error) {
      console.error('Error cleaning messages:', error)
      await InteractionUtils.send(
        intr,
        Lang.getEmbed('errorEmbeds.command', data.lang, {
          ERROR_CODE: intr.id,
          GUILD_ID: intr.guild?.id ?? Lang.getRef('other.na', data.lang),
          SHARD_ID: (intr.guild?.shardId ?? 0).toString(),
        }),
        true,
      )
    }
  }
}
