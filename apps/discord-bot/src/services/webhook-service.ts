import express from 'express'
import bodyParser from 'body-parser'
import { Client } from 'discord.js'
import { Logger } from './logger.js'

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

  private setupRoutes(): void {
    // Route to send messages to a channel
    this.app.post('/webhook/channel', async (req, res) => {
      try {
        // Get data from request
        const { channelId, message, embed } = req.body

        // Simple validation
        if (!channelId || (!message && !embed)) {
          return res.status(400).send({
            error: 'Missing required fields: channelId and message or embed',
          })
        }

        // // Security check - validate a secret key
        // // You should define YOUR_SECRET_KEY in your config
        // if (secret !== process.env.WEBHOOK_SECRET) {
        //     return res.status(401).send({ error: 'Unauthorized' });
        // }

        // Get the channel
        const channel = await this.client.channels.fetch(channelId)
        if (!channel || !('send' in channel)) {
          return res
            .status(404)
            .send({ error: 'Channel not found or not a text channel' })
        }

        // Prepare message payload
        const payload: { content?: string; embeds?: any[] } = {}

        if (message) payload.content = message
        if (embed) payload.embeds = [embed] // Ensure embed is an array

        // Send message to the channel
        await channel.send(payload)

        // Return success
        return res
          .status(200)
          .send({ status: 'Message sent successfully to channel' })
      } catch (error) {
        Logger.error('Error processing channel webhook:', error)
        return res.status(500).send({ error: 'Failed to process webhook' })
      }
    })

    // Route to send direct messages to a user
    this.app.post('/webhook/user', async (req, res) => {
      try {
        // Get data from request
        const { userId, message, embed } = req.body

        // Simple validation
        if (!userId || (!message && !embed)) {
          return res.status(400).send({
            error: 'Missing required fields: channelId and message or embed',
          })
        }

        // // Security check - validate a secret key
        // // You should define YOUR_SECRET_KEY in your config
        // if (secret !== process.env.WEBHOOK_SECRET) {
        //     return res.status(401).send({ error: 'Unauthorized' });
        // }

        try {
          // Fetch the user
          const user = await this.client.users.fetch(userId)

          // Create DM channel and send message
          const dmChannel = await user.createDM()

          // Prepare message payload
          const payload: { content?: string; embeds?: any[] } = {}

          if (message) payload.content = message
          if (embed) payload.embeds = [embed] // Ensure embed is an array

          await dmChannel.send(payload)

          // Return success
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
    })
  }

  public start(): void {
    this.app.listen(this.port, () => {
      Logger.info(`Webhook server started on port ${this.port}`)
    })
  }
}
