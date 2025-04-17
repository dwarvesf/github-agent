import { $Enums, MemberRepository } from '../db'

/**
 * GithubIdToDiscordCIdMapper maps Github ID to Discord Channel ID
 */
class GithubIdMapper {
  /**
   * get the Discord ID for a given Github ID
   * @param githubId The Github ID
   * @returns The Discord ID
   */
  async getDiscordID(githubId: string): Promise<string | undefined> {
    const member = await MemberRepository.getByGithubIdAndPlatform(
      githubId,
      $Enums.Platform.discord,
      {
        platformId: true,
      },
    )
    return member?.platformId
  }

  /**
   * get the Github ID for a given Discord ID
   * @param discordId The Discord ID
   * @returns The Github ID
   */
  async getGithubIDByDiscordId(discordId: string): Promise<string | undefined> {
    const member = await MemberRepository.getByPlatformIdAndPlatform(
      discordId,
      $Enums.Platform.discord,
      {
        githubId: true,
      },
    )
    return member?.githubId
  }
}

export const githubIdMapper = new GithubIdMapper()
