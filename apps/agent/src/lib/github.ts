import { getDaysDifference } from '../utils/datetime'
import { getOneLineCommit } from '../utils/string'
import { Commit } from './type'

// GitHub API configuration
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
export const GITHUB_OWNER = process.env.GITHUB_OWNER
export const GITHUB_REPO = process.env.GITHUB_REPO as string

interface PullRequest {
  number: number
  title: string
  html_url: string
  state: string
  created_at: string
  updated_at: string
  merged_at: string
  user: {
    login: string
    id: number
    avatar_url: string
  }
  draft: boolean
  requested_reviewers: Array<{
    login: string
    id: number
  }>
  labels: Array<{
    name: string
  }>
  body: string
  comments: number
  review_comments: number
  reviews: Array<{
    user: {
      login: string
    }
    state: string
    submitted_at: string
  }>
  mergeable: boolean | null
  mergeable_state: string
}

/**
 * GitHub API client for making requests to the GitHub API
 */
class GitHubClient {
  private headers: HeadersInit
  private owner: string
  private repo: string

  constructor() {
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is not set')
    }

    if (!GITHUB_OWNER) {
      throw new Error('GITHUB_OWNER environment variable is not set')
    }

    if (!GITHUB_REPO) {
      throw new Error(
        'GITHUB_REPO environment variable is not set (needed for some operations)',
      )
    }

    this.headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    }
    this.owner = GITHUB_OWNER
    this.repo = GITHUB_REPO
  }

  isWIP(pr: PullRequest): boolean {
    if (pr.draft) {
      return true
    }

    if (
      pr.title.toLowerCase().includes('wip') ||
      pr.title.toLowerCase().includes('[wip]')
    ) {
      return true
    }

    // Check if PR has labels indicating WIP
    const wipLabels = ['wip', 'work in progress', 'do not review', 'draft']
    if (
      pr.labels.some((label) => wipLabels.includes(label.name.toLowerCase()))
    ) {
      return true
    }

    // Check if PR body contains WIP markers
    if (
      pr.body &&
      (pr.body.toLowerCase().includes('wip') ||
        pr.body.toLowerCase().includes('work in progress') ||
        pr.body.toLowerCase().includes('do not review'))
    ) {
      return true
    }

    return false
  }

  /**
   * Check if PR is waiting for review
   */
  isWaitingForReview(pr: PullRequest): boolean {
    if (this.isWIP(pr)) {
      return false
    }

    if (pr.merged_at !== null) {
      return false
    }

    // Check if PR has been open for at least 1 hour
    const createdAt = new Date(pr.created_at)
    const now = new Date()
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceCreation < 1) {
      return false
    }

    return true
  }

  /**
   * Check if PR has merge conflicts
   */
  hasMergeConflicts(pr: PullRequest): boolean {
    // mergeable can be true, false, or null (when GitHub hasn't computed it yet)
    // mergeable_state can be: clean, dirty, blocked, behind, unstable
    return pr.mergeable === false || pr.mergeable_state === 'dirty'
  }

  /**
   * Check if PR is approved but not merged yet, ignoring dismissed reviews
   * @param pr Pull request to check
   * @returns boolean indicating if PR is approved but not merged
   */
  isApprovedButNotMerged(pr: PullRequest): boolean {
    // If PR is merged, it's not waiting for merge
    if (pr.merged_at !== null) {
      return false
    }

    // If PR is in WIP state, it's not ready for merge
    if (this.isWIP(pr)) {
      return false
    }

    // If there are no reviews, it's not approved
    if (!pr.reviews || pr.reviews.length === 0) {
      return false
    }

    // Sort reviews by submission date to get chronological order
    const sortedReviews = [...pr.reviews].sort(
      (a, b) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    )

    // Find the last approved review
    const lastApprovedReview = [...sortedReviews]
      .reverse()
      .find((review) => review.state === 'APPROVED')

    if (!lastApprovedReview) {
      return false
    }

    // Check if there are any dismissed reviews after the last approval
    const hasDismissedAfterApproval = sortedReviews.some(
      (review) =>
        review.state === 'DISMISSED' &&
        new Date(review.submitted_at).getTime() >
          new Date(lastApprovedReview.submitted_at).getTime(),
    )

    return !hasDismissedAfterApproval
  }

  // https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
  async getRepoPRs(
    repo: string,
    params?: {
      isOpen?: boolean
      isMerged?: boolean
      reviewerId?: string
      authorId?: string
      commenterId?: string
      from?: string // YYYY-MM-DD
      to?: string // YYYY-MM-DD
    },
  ): Promise<PullRequest[]> {
    const prs: PullRequest[] = []

    const {
      isOpen = true,
      isMerged = true,
      reviewerId,
      authorId,
      commenterId,
      from,
      to,
    } = params || {}
    const reviewerFilter = reviewerId
      ? ` user-review-requested:${reviewerId}`
      : ''

    const authorFilter = authorId ? ` author:${authorId}` : ''
    const commenterFilter = commenterId ? ` commenter:${commenterId}` : ''

    try {
      // Fetch open PRs
      if (isOpen) {
        let dateFilter = ''
        if (from || to) {
          if (from) {
            dateFilter = ` updated:>=${from}`
          }
          if (to) {
            dateFilter = ` updated:<=${to}`
          }
        }
        const openQuery = `is:pr is:open ${
          repo ? ` repo:${this.owner}/${repo}` : ''
        }${reviewerFilter}${authorFilter}${commenterFilter}${dateFilter}`
        const openPrs = await this.fetchPRs(openQuery)
        prs.push(...openPrs)
      }

      // Fetch merged PRs
      if (isMerged) {
        let dateFilter = ''
        if (from || to) {
          if (from) {
            dateFilter = ` merged:>=${from}`
          }
          if (to) {
            dateFilter = ` merged:<=${to}`
          }
        }
        const mergedQuery = `is:pr is:merged ${
          repo ? ` repo:${this.owner}/${repo}` : ''
        }${reviewerFilter}${authorFilter}${commenterFilter}${dateFilter}`
        const mergedPrs = await this.fetchPRs(mergedQuery)
        prs.push(...mergedPrs)
      }

      return prs
    } catch (error) {
      console.error('Error fetching organization PRs:', error)
      throw error
    }
  }

  // Helper function to fetch PRs from the GitHub search API
  private async fetchPRs(query: string): Promise<PullRequest[]> {
    const url = `${GITHUB_API_URL}/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc`

    const response = await fetch(url, { headers: this.headers })

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      )
    }

    const searchData = await response.json()
    const prPromises = searchData.items.map(async (item: any) =>
      this.fetchPRDetails(item),
    )

    return Promise.all(prPromises)
  }

  public async getPRReviews(pr: PullRequest): Promise<PullRequest> {
    const urlParts = pr.html_url.split('/')
    const repoName = urlParts[urlParts.length - 3]
    const prNumber = parseInt(urlParts[urlParts.length - 1]!, 10)

    // Fetch PR reviews
    const reviewsUrl = `${GITHUB_API_URL}/repos/${this.owner}/${repoName}/pulls/${prNumber}/reviews`
    const reviewsResponse = await fetch(reviewsUrl, { headers: this.headers })

    if (!reviewsResponse.ok) {
      throw new Error(
        `GitHub API error: ${reviewsResponse.status} ${reviewsResponse.statusText}`,
      )
    }

    const reviews = await reviewsResponse.json()
    return {
      ...pr,
      reviews,
    }
  }

  // Helper function to fetch full PR details
  private async fetchPRDetails(item: any): Promise<PullRequest> {
    const urlParts = item.html_url.split('/')
    const repoName = urlParts[urlParts.length - 3]
    const prNumber = parseInt(urlParts[urlParts.length - 1], 10)
    const prUrl = `${GITHUB_API_URL}/repos/${this.owner}/${repoName}/pulls/${prNumber}`

    const prResponse = await fetch(prUrl, { headers: this.headers })

    if (!prResponse.ok) {
      throw new Error(
        `GitHub API error: ${prResponse.status} ${prResponse.statusText}`,
      )
    }

    return prResponse.json()
  }

  /**
   * Get commits from a repository with optional filters
   * https://docs.github.com/en/rest/commits/commits#list-commits
   */
  async getRepoCommits(
    repo: string,
    params?: {
      authorId?: string
      from?: string // YYYY-MM-DD
      to?: string // YYYY-MM-DD
    },
  ): Promise<Commit[]> {
    try {
      const { authorId, from, to } = params || {}

      const queryParams = new URLSearchParams()
      if (authorId) {
        queryParams.append('author', authorId)
      }
      if (from) {
        queryParams.append('since', `${from}T00:00:00Z`)
      }
      if (to) {
        queryParams.append('until', `${to}T23:59:59Z`)
      }

      const url = `${GITHUB_API_URL}/repos/${this.owner}/${repo}/commits?${queryParams.toString()}`
      const response = await fetch(url, { headers: this.headers })

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        )
      }

      const list = await response.json()

      return list.map((item: any) => ({
        ...item,
        message: getOneLineCommit(item.commit.message),
      }))
    } catch (error) {
      console.error('Error fetching repository commits:', error)
      throw error
    }
  }

  /**
   * Get open PRs that have been inactive (no updates or comments) for a specified period
   * @param repo Repository name
   * @param inactiveDays Number of days without activity to consider PR as inactive
   * @returns Array of inactive pull requests
   */
  async getInactivePRs(
    repo: string,
    inactiveDays: number = 3,
  ): Promise<PullRequest[]> {
    try {
      // Get all open PRs
      const openPRs = await this.getRepoPRs(repo, {
        isOpen: true,
        isMerged: false,
      })
      const now = new Date()

      // Filter PRs based on last activity
      const inactivePRs = openPRs.filter((pr) => {
        // Get the most recent date between updated_at and the latest review
        const lastUpdated = new Date(pr.updated_at)
        if (pr.reviews && pr.reviews.length > 0) {
          const lastReviewDate = new Date(
            Math.max(
              ...pr.reviews.map((r) => new Date(r.submitted_at).getTime()),
            ),
          )
          if (lastReviewDate > lastUpdated) {
            return getDaysDifference(now, lastReviewDate) >= inactiveDays
          }
        }

        return getDaysDifference(now, lastUpdated) >= inactiveDays
      })

      return inactivePRs
    } catch (error) {
      console.error('Error fetching inactive PRs:', error)
      throw error
    }
  }
}

// Create the GitHubClient instance
export const githubClient = new GitHubClient()
