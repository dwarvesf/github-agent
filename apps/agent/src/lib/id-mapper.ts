/**
 * GithubIdToDiscordCIdMapper maps Github ID to Discord Channel ID
 */
class GithubIdMapper {
  private organization: string
  private repository: string

  constructor() {
    this.organization = process.env.GITHUB_ORGANIZATION || ''
    this.repository = process.env.GITHUB_REPOSITORY || ''
  }

  /**
   * get the github id to discord id mapping
   * @returns The mapping
   */
  getDiscordIdMapping(): { githubId: string; discordId: string }[] {
    // TODO: Retrieves the Github IDs from the database
    return [
      { githubId: 'zlatanpham', discordId: '790170208228212766' },
      { githubId: 'R-Jim', discordId: '336090238210408450' },
      { githubId: 'vdhieu', discordId: '797044001579597846' },
      { githubId: 'chinhld12', discordId: '757540075159420948' },
      { githubId: 'catngh', discordId: '319132138849173505' },
    ]
  }

  /**
   * get the Discord ID for a given Github ID
   * @param githubId The Github ID
   * @returns The Discord ID
   */
  getDiscordID(githubId: string): string | undefined {
    const mapping = this.getDiscordIdMapping().find(
      (mapping) => mapping.githubId === githubId,
    )
    return mapping?.discordId
  }
}

export const githubIdMapper = new GithubIdMapper()
