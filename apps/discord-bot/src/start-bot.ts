import { REST } from '@discordjs/rest'
import { Options, Partials } from 'discord.js'
import { createRequire } from 'node:module'

import { Button } from './buttons/index.js'
import {
  DevCommand,
  HelpCommand,
  InfoCommand,
  TestCommand,
  AccessKeyCommand,
} from './commands/chat/index.js'
import {
  ChatCommandMetadata,
  Command,
  MessageCommandMetadata,
  UserCommandMetadata,
} from './commands/index.js'
import { ViewDateSent } from './commands/message/index.js'
import { ViewDateJoined } from './commands/user/index.js'
import {
  ButtonHandler,
  CommandHandler,
  GuildJoinHandler,
  GuildLeaveHandler,
  MessageHandler,
  ReactionHandler,
  TriggerHandler,
  ModalHandler,
} from './events/index.js'
import { CustomClient } from './extensions/index.js'
import { Job } from './jobs/index.js'
import { Bot } from './models/bot.js'
import { Reaction } from './reactions/index.js'
import {
  CommandRegistrationService,
  EventDataService,
  JobService,
  Logger,
  WebhookService,
} from './services/index.js'
import { Trigger } from './triggers/index.js'

const require = createRequire(import.meta.url)
const Config = require('../config/config.json')
const Logs = require('../lang/logs.json')

async function start(): Promise<void> {
  // Services
  const eventDataService = new EventDataService()

  // Client
  const client = new CustomClient({
    intents: Config.client.intents,
    partials: (Config.client.partials as string[]).map(
      (partial) => Partials[partial],
    ),
    makeCache: Options.cacheWithLimits({
      // Keep default caching behavior
      ...Options.DefaultMakeCacheSettings,
      // Override specific options from config
      ...Config.client.caches,
    }),
  })

  // Commands
  const commands: Command[] = [
    // Chat Commands
    new DevCommand(),
    new HelpCommand(),
    new InfoCommand(),
    new TestCommand(),
    new AccessKeyCommand(),

    // Message Context Commands
    new ViewDateSent(),

    // User Context Commands
    new ViewDateJoined(),

    // TODO: Add new commands here
  ]

  // Buttons
  const buttons: Button[] = [
    // TODO: Add new buttons here
  ]

  // Reactions
  const reactions: Reaction[] = [
    // TODO: Add new reactions here
  ]

  // Triggers
  const triggers: Trigger[] = [
    // TODO: Add new triggers here
  ]

  // Event handlers
  const guildJoinHandler = new GuildJoinHandler(eventDataService)
  const guildLeaveHandler = new GuildLeaveHandler()
  const commandHandler = new CommandHandler(commands, eventDataService)
  const buttonHandler = new ButtonHandler(buttons, eventDataService)
  const triggerHandler = new TriggerHandler(triggers, eventDataService)
  const messageHandler = new MessageHandler(triggerHandler)
  const reactionHandler = new ReactionHandler(reactions, eventDataService)
  const modalHandler = new ModalHandler()

  // Jobs
  const jobs: Job[] = [
    // TODO: Add new jobs here
  ]

  // Bot
  const bot = new Bot(
    Config.client.token,
    client,
    guildJoinHandler,
    guildLeaveHandler,
    messageHandler,
    commandHandler,
    buttonHandler,
    reactionHandler,
    modalHandler,
    new JobService(jobs),
  )

  // Register
  if (process.argv[2] == 'commands') {
    try {
      const rest = new REST({ version: '10' }).setToken(Config.client.token)
      const commandRegistrationService = new CommandRegistrationService(rest)
      const localCmds = [
        ...Object.values(ChatCommandMetadata).sort((a, b) =>
          a.name > b.name ? 1 : -1,
        ),
        ...Object.values(MessageCommandMetadata).sort((a, b) =>
          a.name > b.name ? 1 : -1,
        ),
        ...Object.values(UserCommandMetadata).sort((a, b) =>
          a.name > b.name ? 1 : -1,
        ),
      ]
      await commandRegistrationService.process(localCmds, process.argv)
    } catch (error) {
      Logger.error(Logs.error.commandAction, error)
    }
    // Wait for any final logs to be written.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    process.exit()
  }

  await bot.start()

  // Initialize and start webhook service
  const webhookService = new WebhookService(
    client,
    Config.webhook?.port || 3000,
  )
  webhookService.start()
}

process.on('unhandledRejection', (reason) => {
  Logger.error(Logs.error.unhandledRejection, reason)
})

start().catch((error) => {
  Logger.error(Logs.error.unspecified, error)
})
