import { REST } from '@discordjs/rest'
import { Options, Partials } from 'discord.js'
import { createRequire } from 'node:module'

import { AskCommand } from './commands/chat/index.js'
import { ChatCommandMetadata, Command } from './commands/index.js'
import { CommandHandler } from './events/index.js'
import { CustomClient } from './extensions/index.js'
import { Bot } from './models/bot.js'
import {
  CommandRegistrationService,
  EventDataService,
  Logger,
  WebhookService,
} from './services/index.js'

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
    new AskCommand(),
  ]

  // Event handlers
  const commandHandler = new CommandHandler(commands, eventDataService)

  // Bot
  const bot = new Bot(Config.client.token, client, commandHandler)

  // Register
  if (process.argv[2] == 'commands') {
    try {
      const rest = new REST({ version: '10' }).setToken(Config.client.token)
      const commandRegistrationService = new CommandRegistrationService(rest)
      const localCmds = [
        ...Object.values(ChatCommandMetadata).sort((a, b) =>
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
