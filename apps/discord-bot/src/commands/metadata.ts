import {
  ApplicationCommandType,
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
}
