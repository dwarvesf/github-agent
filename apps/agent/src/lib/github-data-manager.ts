import { GitHubClient } from './github'

/**
 * Class that manages the interaction between GitHub repositories and Discord DM channels.
 *
 * This class facilitates operations related to GitHub repositories that are connected to
 * specific Discord DM channels. It provides functionality to initialize GitHub clients
 * with proper authentication, retrieve organization data, and work with repositories
 * linked to Discord channels.
 *
 * @remarks
 * Before using most methods in this class, you must call `initClient()` to properly
 * initialize the GitHub client and retrieve the necessary organization data.
 *
 * @example
 * ```typescript
 * const repoUser = new RepositoryDMChannelUser();
 * await repoUser.initClient('my-organization');
 * const repositories = repoUser.groupRepositories();
 * ```
 */
export class GithubDataManager {
  /** Authenticated GitHub client instance for API operations */
  private githubClient!: GitHubClient

  /** Cached organization data including channels and their associated repositories */
  private organizationData!: Awaited<
    ReturnType<typeof GitHubClient.getOrganizationData>
  >

  /**
   * Returns the initialized GitHub client
   *
   * @returns The GitHubClient instance
   * @throws Error if called before initialization
   */
  public getGithubClient() {
    this.invalidate('githubClient')
    return this.githubClient
  }

  /**
   * Returns the cached organization data
   *
   * @returns Organization data including channels and repositories
   * @throws Error if called before initialization
   */
  public getOrganizationData() {
    this.invalidate('organizationData')
    return this.organizationData
  }

  /**
   * Initializes the GitHub client with the specified organization
   *
   * This method fetches organization data from the database, validates it,
   * and creates an authenticated GitHub client. It also checks that the organization
   * has at least one repository.
   *
   * @param organizationOwner - The GitHub organization name or identifier
   * @throws Error if no organization is found with the given name
   * @throws Error if the organization has no repositories
   */
  public async initClient(organizationOwner: string) {
    const { organization, channels } =
      await GitHubClient.getOrganizationData(organizationOwner)
    if (!organization || !organization.githubTokenId) {
      throw new Error(
        `No organization found with this organization: ${organizationOwner}`,
      )
    }
    // Validate repository exists
    if (!channels.some((channel) => channel.repositories.length)) {
      throw new Error('No repositories found for organization')
    }
    this.githubClient = new GitHubClient({
      githubOwner: organization.githubName,
      githubToken: organization.githubTokenId,
    })

    this.organizationData = { organization, channels }
  }

  /**
   * Validates that organization data has been properly initialized
   *
   * @private
   * @throws Error if organization data is not initialized
   */
  private invalidate(field: 'githubClient' | 'organizationData') {
    if (!this[field]) {
      throw new Error(
        `${field} was not initialized! Run initClient before this method!`,
      )
    }
  }

  /**
   * Groups repositories from all channels into a unique list
   *
   * This method collects repositories from all channels in the organization,
   * ensuring each repository is only included once even if it appears in multiple channels.
   *
   * @returns Array of unique repositories with their organization name and channel ID
   * @throws Error if called before initialization
   */
  public groupRepositories() {
    this.invalidate('organizationData')
    return this.organizationData.channels.reduce<
      Array<{ repoName: string; orgName: string }>
    >((acc, item) => {
      const newRepositories = item.repositories.map((repo) => ({
        repoName: repo.githubRepoName,
        orgName: this.organizationData.organization!.githubName,
        channelId: repo.channelId,
      }))

      // Only add unique combinations
      const existingCombos = new Set(
        acc.map((r) => `${r.orgName}/${r.repoName}`),
      )
      const uniqueNewRepos = newRepositories.filter(
        (repo) => !existingCombos.has(`${repo.orgName}/${repo.repoName}`),
      )
      return [...acc, ...uniqueNewRepos]
    }, [])
  }
}
