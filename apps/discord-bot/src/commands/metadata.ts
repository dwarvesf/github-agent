import {
  ApplicationCommandType,
  PermissionFlagsBits,
  PermissionsBitField,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js'

import { Args } from './index.js'
import { Language } from '../models/enum-helpers/index.js'
import { Lang } from '../services/index.js'

export const ChatCommandMetadata: {
  [command: string]: RESTPostAPIChatInputApplicationCommandsJSONBody
} = {
  ASK: {
    type: ApplicationCommandType.ChatInput,
    name: Lang.getRef('chatCommands.ask', Language.Default),
    name_localizations: Lang.getRefLocalizationMap('chatCommands.ask'),
    description: Lang.getRef('commandDescs.ask', Language.Default),
    description_localizations: Lang.getRefLocalizationMap('commandDescs.ask'),
    dm_permission: true,
    default_member_permissions: undefined,
    options: [
      {
        ...Args.PROMPT,
        required: true,
      },
    ],
  },
  CLEAN: {
    type: ApplicationCommandType.ChatInput,
    name: Lang.getRef('chatCommands.clean', Language.Default),
    name_localizations: Lang.getRefLocalizationMap('chatCommands.clean'),
    description: Lang.getRef('commandDescs.clean', Language.Default),
    description_localizations: Lang.getRefLocalizationMap('commandDescs.clean'),
    dm_permission: true,
    default_member_permissions: PermissionsBitField.resolve([
      PermissionFlagsBits.Administrator,
    ]).toString(),
    options: [
      {
        ...Args.AMOUNT,
        required: true,
      },
    ],
  },
}
