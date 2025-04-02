import {
  APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
} from 'discord.js'

import { Language } from '../models/enum-helpers/index.js'
import { Lang } from '../services/index.js'

export class Args {
  public static readonly PROMPT: APIApplicationCommandBasicOption = {
    name: Lang.getRef('arguments.promptText', Language.Default),
    name_localizations: Lang.getRefLocalizationMap('arguments.promptText'),
    description: Lang.getRef('argDescs.promptText', Language.Default),
    description_localizations: Lang.getRefLocalizationMap(
      'argDescs.promptText',
    ),
    type: ApplicationCommandOptionType.String,
  }

  public static readonly AMOUNT: APIApplicationCommandBasicOption = {
    name: Lang.getRef('arguments.amount', Language.Default),
    name_localizations: Lang.getRefLocalizationMap('arguments.amount'),
    description: Lang.getRef('argDescs.amount', Language.Default),
    description_localizations: Lang.getRefLocalizationMap('argDescs.amount'),
    type: ApplicationCommandOptionType.Integer,
  }
}
