// Discord API configuration
const DISCORD_BOT_BASE_URL = `${process.env.DISCORD_BOT_BASE_URL}/webhook`
export const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || ''

/**
 * Discord client for making requests to the Discord webhook
 */
class DiscordClient {
  private headers: HeadersInit

  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
    }
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
    embed,
  }: {
    channelId: string
    message?: string
    embed?: Record<string, unknown>
  }): Promise<string> {
    const response = await fetch(`${DISCORD_BOT_BASE_URL}/channel`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        channelId,
        message,
        embed,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.text()
  }

  /**
   * Send a message to a Discord user
   * @param userId The ID of the user to send the message to
   * @param message The message to send
   * @returns The response from the Discord webhook
   */
  async sendMessageToUser({
    message,
    userId,
    embed,
  }: {
    userId: string
    message?: string
    embed?: Record<string, unknown>
  }): Promise<string> {
    const response = await fetch(`${DISCORD_BOT_BASE_URL}/user`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        userId,
        message,
        embed,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.text()
  }
}

// Export a singleton instance
export const discordClient = new DiscordClient()
