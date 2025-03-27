import {
  AutocompleteInteraction,
  Client,
  CommandInteraction,
  Events,
  Interaction,
  RateLimitData,
  RESTEvents,
} from 'discord.js'
import { createRequire } from 'node:module'

import { CommandHandler } from '../events/index.js'
import { Logger } from '../services/index.js'

const require = createRequire(import.meta.url)
const Config = require('../../config/config.json')
const Debug = require('../../config/debug.json')
const Logs = require('../../lang/logs.json')

export class Bot {
  private ready = false

  constructor(
    private token: string,
    private client: Client,
    private commandHandler: CommandHandler,
  ) {}

  public async start(): Promise<void> {
    this.registerListeners()
    await this.login(this.token)
  }

  private registerListeners(): void {
    this.client.on(Events.ClientReady, () => this.onReady())
    this.client.on(
      Events.ShardReady,
      (shardId: number, unavailableGuilds: Set<string>) =>
        this.onShardReady(shardId, unavailableGuilds),
    )
    this.client.on(Events.InteractionCreate, (intr: Interaction) =>
      this.onInteraction(intr),
    )
    this.client.rest.on(
      RESTEvents.RateLimited,
      (rateLimitData: RateLimitData) => this.onRateLimit(rateLimitData),
    )
  }

  private async login(token: string): Promise<void> {
    try {
      await this.client.login(token)
    } catch (error) {
      Logger.error(Logs.error.clientLogin, error)
      return
    }
  }

  private async onReady(): Promise<void> {
    const userTag = this.client.user?.tag
    Logger.info(Logs.info.clientLogin.replaceAll('{USER_TAG}', userTag))

    this.ready = true
    Logger.info(Logs.info.clientReady)
  }

  private onShardReady(shardId: number, _unavailableGuilds: Set<string>): void {
    Logger.setShardId(shardId)
  }

  private async onInteraction(intr: Interaction): Promise<void> {
    if (
      !this.ready ||
      (Debug.dummyMode.enabled &&
        !Debug.dummyMode.whitelist.includes(intr.user.id))
    ) {
      return
    }

    if (
      intr instanceof CommandInteraction ||
      intr instanceof AutocompleteInteraction
    ) {
      try {
        await this.commandHandler.process(intr)
      } catch (error) {
        Logger.error(Logs.error.command, error)
      }
    }
  }

  private async onRateLimit(rateLimitData: RateLimitData): Promise<void> {
    if (
      rateLimitData.timeToReset >=
      Config.logging.rateLimit.minTimeout * 1000
    ) {
      Logger.error(Logs.error.apiRateLimit, rateLimitData)
    }
  }
}
