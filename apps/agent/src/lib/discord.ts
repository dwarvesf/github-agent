import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Discord API configuration
const DISCORD_WEBHOOK_URL = 'http://localhost:3000/webhook/channel';

/**
 * Discord client for making requests to the Discord webhook
 */
class DiscordClient {
  private headers: HeadersInit;

  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a message to a Discord channel
   * @param channelId The ID of the channel to send the message to
   * @param message The message to send
   * @returns The response from the Discord webhook
   */
  async sendMessageToChannel({
    channelId,
    message,
  }: {
    channelId: string;
    message: string;
  }): Promise<string> {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        channelId,
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  }
}

// Export a singleton instance
export const discordClient = new DiscordClient();
