import express from 'express'
import bodyParser from 'body-parser'
import { APIEmbed, Client, ActionRowBuilder, ButtonBuilder } from 'discord.js'
import { Logger } from '../services/index.js'
import { RootController } from '../controllers/root-controller.js'
import { Controller } from '../controllers/index.js'
import {
  processResponseToEmbedFields,
  splittingDescriptionEmbedToMultipleEmbeds,
  splittingResponseFieldsToEmbedFields,
} from '../commands/common.js'
import { PaginationUtils } from '../utils/pagination-utils.js'

interface MessagePayload {
  content?: string
  embeds?: APIEmbed[]
  components?: ActionRowBuilder<ButtonBuilder>[]
}

interface WebhookRequest {
  message?: string
  embed?: any
  secret?: string
}

interface ChannelWebhookRequest extends WebhookRequest {
  channelId: string
}

interface UserWebhookRequest extends WebhookRequest {
  userId: string
}

export class WebhookService {
  private app: express.Application
  private client: Client
  private port: number

  constructor(client: Client, port: number = 4000) {
    this.client = client
    this.port = port
    this.app = express()
    this.app.use(bodyParser.json())
    this.setupRoutes()
  }

  private async createMessagePayload(
    request: WebhookRequest,
  ): Promise<MessagePayload> {
    const payload: MessagePayload = {}

    if (request.message) {
      payload.content = request.message
    }

    if (request.embed) {
      let embeds = [request.embed]
      if (request.embed.table) {
        embeds = await processResponseToEmbedFields(
          this.client,
          '',
          request.embed.table.value,
        )
        embeds = embeds.map((fields) => ({
          ...request.embed,
          fields,
        }))
        delete request.embed.table
      }

      if (request.embed.description) {
        embeds = splittingDescriptionEmbedToMultipleEmbeds(request.embed)
      }

      if (Array.isArray(request.embed.fields)) {
        embeds = splittingResponseFieldsToEmbedFields(request.embed.fields)
        embeds = embeds.map((fields) => ({
          ...request.embed,
          fields,
        }))
      }
      payload.embeds = embeds
    }

    return payload
  }

  private validateRequest(
    targetId: string,
    request: WebhookRequest,
    res: express.Response,
  ): boolean {
    // Check required fields
    if (!targetId || (!request.message && !request.embed)) {
      res.status(400).send({
        error: 'Missing required fields: target ID and message or embed',
      })
      return false
    }

    // Uncomment to enable security validation
    // if (request.secret !== process.env.WEBHOOK_SECRET) {
    //   res.status(401).send({ error: 'Unauthorized' });
    //   return false;
    // }

    return true
  }

  private handleChannelMessage = async (
    req: express.Request,
    res: express.Response,
  ): Promise<express.Response> => {
    try {
      const request = req.body as ChannelWebhookRequest

      if (!this.validateRequest(request.channelId, request, res)) {
        return res
      }

      // Get the channel
      const channel = await this.client.channels.fetch(request.channelId)
      if (!channel || !('send' in channel)) {
        return res
          .status(404)
          .send({ error: 'Channel not found or not a text channel' })
      }

      // Create and send message
      const payload = await this.createMessagePayload(request)

      // Setup pagination if needed
      if (payload.embeds && payload.embeds.length > 1) {
        PaginationUtils.setupWebhookPaginationCollector(
          channel,
          payload.embeds,
          payload.content,
        )
      } else {
        await channel.send(payload)
      }

      return res
        .status(200)
        .send({ status: 'Message sent successfully to channel' })
    } catch (error) {
      Logger.error('Error processing channel webhook:', error)
      return res.status(500).send({ error: 'Failed to process webhook' })
    }
  }

  private handleUserMessage = async (
    req: express.Request,
    res: express.Response,
  ): Promise<express.Response> => {
    try {
      const request = req.body as UserWebhookRequest

      if (!this.validateRequest(request.userId, request, res)) {
        return res
      }

      try {
        // Fetch the user and create DM channel
        const user = await this.client.users.fetch(request.userId)
        const dmChannel = await user.createDM()

        // Create and send message
        const payload = await this.createMessagePayload(request)

        // Setup pagination if needed
        if (payload.embeds && payload.embeds.length > 1) {
          PaginationUtils.setupWebhookPaginationCollector(
            dmChannel,
            payload.embeds,
            payload.content,
          )
        } else {
          await dmChannel.send(payload)
        }

        return res
          .status(200)
          .send({ status: 'Message sent successfully to user' })
      } catch (userError) {
        Logger.error('Error sending DM to user:', userError)
        return res
          .status(404)
          .send({ error: 'User not found or cannot send DM to this user' })
      }
    } catch (error) {
      Logger.error('Error processing user webhook:', error)
      return res.status(500).send({ error: 'Failed to process webhook' })
    }
  }

  private setupRoutes(): void {
    // Register controllers
    const controllers: Controller[] = [new RootController()]

    controllers.forEach((controller) => {
      controller.register()
      this.app.use(controller.path, controller.router)
    })

    // Register webhook routes
    this.app.post('/webhook/channel', this.handleChannelMessage)
    this.app.post('/webhook/user', this.handleUserMessage)
  }

  public start(): void {
    this.app.listen(this.port, () => {
      Logger.info(`Webhook server started on port ${this.port}`)
    })
  }
}
