import express from 'express';
import bodyParser from 'body-parser';
import { Client } from 'discord.js';
import { Logger } from './logger.js';

export class WebhookService {
    private app: express.Application;
    private client: Client;
    private port: number;

    constructor(client: Client, port: number = 3000) {
        this.client = client;
        this.port = port;
        this.app = express();
        this.app.use(bodyParser.json());
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Route to receive webhook requests
        this.app.post('/webhook', async (req, res) => {
            try {
                // Get data from request
                const { channelId, message, secret } = req.body;

                // Simple validation
                if (!channelId || !message) {
                    return res.status(400).send({ error: 'Missing required fields: channelId and message' });
                }

                // // Security check - validate a secret key
                // // You should define YOUR_SECRET_KEY in your config
                // if (secret !== process.env.WEBHOOK_SECRET) {
                //     return res.status(401).send({ error: 'Unauthorized' });
                // }

                // Get the channel
                const channel = await this.client.channels.fetch(channelId);
                if (!channel || !('send' in channel)) {
                    return res.status(404).send({ error: 'Channel not found or not a text channel' });
                }

                // Send message to the channel
                await channel.send(message);

                // Return success
                return res.status(200).send({ status: 'Message sent successfully' });
            } catch (error) {
                Logger.error('Error processing webhook:', error);
                return res.status(500).send({ error: 'Failed to process webhook' });
            }
        });    }

    public start(): void {
        this.app.listen(this.port, () => {
            Logger.info(`Webhook server started on port ${this.port}`);
        });
    }
}