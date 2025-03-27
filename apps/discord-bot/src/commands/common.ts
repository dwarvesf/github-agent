import { APIEmbedField, Client } from 'discord.js'

const hardCodeIDMap = {
  zlatanpham: '790170208228212766',
  'R-Jim': '336090238210408450',
  vdhieu: '797044001579597846',
  chinhld12: '757540075159420948',
  catngh: '319132138849173505',
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
    return (
      '@' +
      (Object.entries(idMap).find(([_, v]) => v === discordId)?.[0] || match)
    )
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

// Constants for regex patterns
const TABLE_SEPARATOR_PATTERN = /^(\|\s*:?-+:?\s*)+\|$/
const LINK_PATTERN = /\[(.*?)\]\((.*?)\)/
const URL_PATTERN = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
const BOLD_LINK_PATTERN = /\[\*{0,2}(.*?)\*{0,2}\]/
const DISCORD_MENTION_PATTERN = /<@!?(\d+)>/

interface TableCell {
  content: string
  isLink: boolean
  isUrl: boolean
  isMention: boolean
  align: 'left' | 'center' | 'right' // Always include alignment
}

function parseTableCell(
  cell: string,
  align: 'left' | 'center' | 'right' = 'left',
): TableCell {
  const isLink = LINK_PATTERN.test(cell)
  const isMention = DISCORD_MENTION_PATTERN.test(cell)

  let isUrl = false
  if (isLink) {
    const linkText = cell.match(LINK_PATTERN)[1]
    isUrl = URL_PATTERN.test(linkText)
  }

  return {
    content: cell,
    isLink,
    isUrl,
    isMention,
    align,
  }
}

function getCellWidth(
  cell: TableCell,
  idUsernameMap?: Map<string, string>,
): number {
  if (cell.isLink) {
    if (cell.isUrl) {
      return 8 // LINK + 4 spaces
    }
    const linkTextMatch = cell.content.match(BOLD_LINK_PATTERN)
    return (
      (linkTextMatch ? linkTextMatch[1] : cell.content.match(LINK_PATTERN)[1])
        .length + 4 // 4 spaces
    )
  }

  if (cell.isMention) {
    const match = DISCORD_MENTION_PATTERN.exec(cell.content)
    return (idUsernameMap?.get(match[1])?.length ?? 0) + 1
  }

  return cell.content.length
}

function formatTableCell(cell: TableCell, width: number): string {
  if (cell.isLink) {
    const linkTextMatch = cell.content.match(BOLD_LINK_PATTERN)
    let contentLength = 0

    if (linkTextMatch) {
      contentLength = linkTextMatch[1].length
    } else {
      const linkMatch = cell.content.match(LINK_PATTERN)
      if (linkMatch) contentLength = linkMatch[1].length
    }

    const padding = width - contentLength - 3

    if (cell.isUrl) {
      const formattedCell = cell.content.replace(LINK_PATTERN, '[**Link**]')
      return `\` \` ${formattedCell} \`${''.padEnd(Math.max(1, padding))}\``
    }
    return `\` \` ${cell.content} \`${''.padEnd(Math.max(1, padding))}\``
  }

  if (cell.isMention) {
    return cell.content.padEnd(width)
  }

  // Apply alignment to regular cells
  const content = cell.content
  const remainingSpace = width - content.length

  if (cell.align === 'right') {
    return `\`${' '.repeat(remainingSpace)}${content}\``
  } else if (cell.align === 'center') {
    const leftPad = Math.floor(remainingSpace / 2)
    const rightPad = remainingSpace - leftPad
    return `\`${' '.repeat(leftPad)}${content}${' '.repeat(rightPad)}\``
  } else {
    // Default left alignment
    return `\`${content.padEnd(width)}\``
  }
}

export function convertMarkdownTable(
  markdown: string,
  idUsernameMap?: Map<string, string>,
): string {
  // Split into lines
  const lines = markdown.split('\n').map((line) => line.trim())

  // Find header and separator row
  const separatorRowIndex = lines.findIndex((line) =>
    TABLE_SEPARATOR_PATTERN.test(line),
  )

  if (separatorRowIndex === -1 || separatorRowIndex === 0) {
    // If no proper separator found or it's the first line, use default processing
    return defaultTableProcessing(markdown, idUsernameMap)
  }

  // Parse alignments from separator row
  const separatorCells = lines[separatorRowIndex]
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

  const alignments = separatorCells.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center' as const
    if (cell.endsWith(':')) return 'right' as const
    return 'left' as const
  })

  // Filter out the separator row
  const contentRows = [
    ...lines.slice(0, separatorRowIndex),
    ...lines.slice(separatorRowIndex + 1),
  ]

  // Convert rows to table cells with correct alignment
  const table: TableCell[][] = contentRows.map((line) => {
    const cells = line.split('|').slice(1, -1)
    return cells.map((cell, index) => {
      // Use default alignment if index is out of bounds
      const align = index < alignments.length ? alignments[index] : 'left'
      return parseTableCell(cell.trim(), align)
    })
  })

  // Determine column widths
  const colWidths = []
  for (let i = 0; i < table[0].length; i++) {
    const colWidth = Math.max(
      ...table.map((row) => {
        return i < row.length ? getCellWidth(row[i], idUsernameMap) : 0
      }),
    )
    colWidths.push(colWidth)
  }

  // Format each row
  return table
    .map((row) =>
      row
        .map((cell, colIndex) => formatTableCell(cell, colWidths[colIndex]))
        .join(' '),
    )
    .join('\n')
}

// Fallback to original table processing if no alignment is specified
function defaultTableProcessing(
  markdown: string,
  idUsernameMap?: Map<string, string>,
): string {
  // Split into lines and remove separator row
  const rows = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !TABLE_SEPARATOR_PATTERN.test(line))

  // Convert each row into an array of cells (all left-aligned by default)
  const table: TableCell[][] = rows.map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => parseTableCell(cell.trim(), 'left')),
  )

  // Determine column widths
  const colWidths = table[0].map((_, colIndex) =>
    Math.max(...table.map((row) => getCellWidth(row[colIndex], idUsernameMap))),
  )

  // Format each row
  return table
    .map((row) =>
      row
        .map((cell, colIndex) => formatTableCell(cell, colWidths[colIndex]))
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
