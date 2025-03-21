import express from 'express'
import bodyParser from 'body-parser'
import { Client } from 'discord.js'
import { Logger } from '../services/index.js'
import { replaceGitHubMentions } from '../commands/index.js'

interface MessagePayload {
  content?: string
  embeds?: any[]
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

  constructor(client: Client, port: number = 3000) {
    this.client = client
    this.port = port
    this.app = express()
    this.app.use(bodyParser.json())
    this.setupRoutes()
  }

  private createMessagePayload(request: WebhookRequest): MessagePayload {
    const payload: MessagePayload = {}

    if (request.message) {
      payload.content = replaceGitHubMentions(request.message)[0]
    }

    if (request.embed) {
      // Process embed description if it exists
      if (request.embed.description) {
        request.embed.description = replaceGitHubMentions(
          request.embed.description,
        )[0]
      }

      // Process all embed fields if they exist
      if (request.embed.fields && Array.isArray(request.embed.fields)) {
        request.embed.fields = request.embed.fields.map((field) => ({
          ...field,
          value: field.value
            ? replaceGitHubMentions(field.value)[0]
            : field.value,
        }))
      }

      payload.embeds = [request.embed]
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
      const payload = this.createMessagePayload(request)
      await channel.send(payload)

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
        const payload = this.createMessagePayload(request)
        await dmChannel.send(payload)

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
    this.app.post('/webhook/channel', this.handleChannelMessage)
    this.app.post('/webhook/user', this.handleUserMessage)
  }

  public start(): void {
    this.app.listen(this.port, () => {
      Logger.info(`Webhook server started on port ${this.port}`)
    })
  }
}
