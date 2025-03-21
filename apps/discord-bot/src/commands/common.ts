import { APIEmbedField, Client } from 'discord.js'

const hardCodeIDMap = {
  zlatanpham: '790170208228212766',
  'R-Jim': '336090238210408450',
  vdhieu: '797044001579597846',
}

export function replaceGitHubMentions(
  text: string,
  idMap: Record<string, string> = hardCodeIDMap,
): [string, Set<string>] {
  const foundDiscordIDs: Set<string> = new Set()
  return [
    text.replace(/@([a-zA-Z0-9_-]+)/g, (match, githubId) => {
      const discordId = idMap[githubId]
      if (discordId) {
        foundDiscordIDs.add(discordId)
        return `<@!${discordId}>`
      }
      return match
    }),
    foundDiscordIDs,
  ]
}

export function replaceDiscordMentions(
  text: string,
  idMap: Record<string, string> = hardCodeIDMap,
): string {
  return text.replace(/<@?(\d+)>/g, (match, discordId) => {
    return "@"+(Object.entries(idMap).find(([_, v]) => v === discordId)?.[0] || match)
  })
}

export async function getUsername(
  client: Client,
  user_id: string,
  guild_id?: string,
): Promise<string | null> {
  try {
    if (guild_id) {
      try {
        const guild = await client.guilds.fetch(guild_id)
        const member = await guild.members.fetch(user_id)
        return member.user.username
      } catch (memberError) {
        console.warn(
          `User ${user_id} not found in guild ${guild_id}, fetching globally.`,
        )
      }
    }

    const user = await client.users.fetch(user_id)
    return user.globalName ? user.globalName : user.username
  } catch (error) {
    console.error('Error fetching username:', error)
    return null
  }
}

export async function processResponseToEmbedFields(
  client: Client,
  guildID: string,
  response: string,
): Promise<APIEmbedField[]> {
  const fields: APIEmbedField[] = []
  const maxChunkSize = 800
  const [lines, discordIDs] = replaceGitHubMentions(response)
  let currentChunk = ''
  let isTable = false
  const idUsernameMap = await mapDiscordUsernameToID(
    client,
    guildID,
    discordIDs,
  )

  const pushField = () => {
    if (currentChunk) {
      fields.push({
        name: isTable ? 'Table' : 'Text',
        value: isTable
          ? convertMarkdownTable(currentChunk, idUsernameMap)
          : currentChunk,
        inline: false,
      })
      currentChunk = ''
    }
  }

  for (const line of lines.split('\n')) {
    const isCurrentLineTable = line.trim().startsWith('|') && line.includes('|')

    if (isCurrentLineTable !== isTable) {
      pushField()
      isTable = isCurrentLineTable
    }

    if (currentChunk.length + line.length + 1 > maxChunkSize) {
      pushField()
    }

    currentChunk += (currentChunk ? '\n' : '') + line
  }

  pushField()

  return fields.map((field) => ({
    name: '',
    value: field.value,
    inline: false,
  }))
}

function convertMarkdownTable(
  markdown: string,
  idUsernameMap?: Map<string, string>,
): string {
  // Split into lines and remove separator row
  const rows = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !/^(\|\s*-+\s*)+\|$/.test(line))

  // Convert each row into an array of cells
  const table: string[][] = rows.map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim()),
  )

  // Determine column widths, treating links as fixed 7 characters (including padding)
  const colWidths = table[0].map((_, colIndex) =>
    Math.max(
      ...table.map((row) => {
        if (/\[(.*?)\]\((.*?)\)/.test(row[colIndex])) {
          return 7
        }
        const match = /<@!?(\d+)>/.exec(row[colIndex])
        if (match) {
          return idUsernameMap.get(match[1])?.length + 2 || 0 // +2 for the @ symbol
        }
        return row[colIndex].length
      }),
    ),
  )

  // Format each row, replacing link display text with "Link" and aligning columns
  return table
    .map((row) =>
      row
        .map((cell, colIndex) => {
          if (/\[(.*?)\]\((.*?)\)/.test(cell)) {
            return `\` \`[**Link**](${cell.match(/\((.*?)\)/)![1]}) \` \`` // Replace text, keep URL
          }
          if (/<@!?(\d+)>/g.test(cell)) {
            return `${cell}`.padEnd(colWidths[colIndex])
          }
          return `\`${cell.padEnd(colWidths[colIndex])}\`` // Pad non-link cells
        })
        .join(' '),
    )
    .join('\n')
}

async function mapDiscordUsernameToID(
  client: Client,
  guildID: string,
  ids: Set<string>,
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>()

  await Promise.all(
    Array.from(ids).map(async (id) => {
      const username = await getUsername(client, id, guildID)
      resultMap.set(id, username)
    }),
  )

  return resultMap
}
