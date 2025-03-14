import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// GitHub API configuration
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  draft: boolean;
  requested_reviewers: Array<{
    login: string;
    id: number;
  }>;
  labels: Array<{
    name: string;
  }>;
  body: string;
  comments: number;
  review_comments: number;
  reviews: Array<{
    user: {
      login: string;
    };
    state: string;
    submitted_at: string;
  }>;
}

/**
 * GitHub API client for making requests to the GitHub API
 */
class GitHubClient {
  private headers: HeadersInit;
  private owner: string;
  private repo: string;

  constructor() {
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is not set');
    }

    if (!GITHUB_OWNER) {
      throw new Error('GITHUB_OWNER environment variable is not set');
    }

    if (!GITHUB_REPO) {
      throw new Error(
        'GITHUB_REPO environment variable is not set (needed for some operations)',
      );
    }

    this.headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    };
    this.owner = GITHUB_OWNER;
    this.repo = GITHUB_REPO;
  }

  /**
   * Get open pull requests across the organization
   */
  async getOrgOpenPRs(repo?: string): Promise<PullRequest[]> {
    // Using the search API to get all open PRs in the organization
    // https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#search-issues-and-pull-requests
    let query = `is:pr is:open org:${this.owner}`;
    if (repo) {
      query += ` repo:${repo}`;
    }
    const url = `${GITHUB_API_URL}/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc`;

    try {
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      const searchData = await response.json();

      // The search API returns a different format, so we need to map it to our PullRequest interface
      // and fetch additional details for each PR
      const prs: PullRequest[] = [];
      const prPromises = searchData.items.map(async (item: any) => {
        // Extract repo name and PR number from the html_url
        // Format is typically: https://github.com/owner/repo/pull/number
        const urlParts = item.html_url.split('/');
        const repoName = urlParts[urlParts.length - 3];
        const prNumber = parseInt(urlParts[urlParts.length - 1], 10);

        // Get full PR details
        const prUrl = `${GITHUB_API_URL}/repos/${this.owner}/${repoName}/pulls/${prNumber}`;
        const prResponse = await fetch(prUrl, { headers: this.headers });

        if (prResponse.ok) {
          const prData = await prResponse.json();
          prs.push(prData);
        }
      });

      // Wait for all PR detail requests to complete
      await Promise.all(prPromises);

      return prs;
    } catch (error) {
      console.error('Error fetching organization open PRs:', error);
      throw error;
    }
  }

  /**
   * Get pull request details
   */
  async getPrDetails(prNumber: number): Promise<PullRequest> {
    // Get the PR details
    const prUrl = `${GITHUB_API_URL}/repos/${this.owner}/${this.repo}/pulls/${prNumber}`;
    const prResponse = await fetch(prUrl, { headers: this.headers });

    if (!prResponse.ok) {
      throw new Error(
        `GitHub API error: ${prResponse.status} ${prResponse.statusText}`,
      );
    }

    const pr = (await prResponse.json()) as PullRequest;

    // Get comments
    const commentsUrl = `${GITHUB_API_URL}/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`;
    const commentsResponse = await fetch(commentsUrl, {
      headers: this.headers,
    });

    // Get reviews
    const reviewsUrl = `${GITHUB_API_URL}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews`;
    const reviewsResponse = await fetch(reviewsUrl, { headers: this.headers });

    const reviews = await reviewsResponse.json();

    return {
      ...pr,
      reviews,
    };
  }

  isWIP(pr: PullRequest): boolean {
    if (pr.draft) {
      return true;
    }

    if (
      pr.title.toLowerCase().includes('wip') ||
      pr.title.toLowerCase().includes('[wip]')
    ) {
      return true;
    }

    // Check if PR has labels indicating WIP
    const wipLabels = ['wip', 'work in progress', 'do not review', 'draft'];
    if (
      pr.labels.some((label) => wipLabels.includes(label.name.toLowerCase()))
    ) {
      return true;
    }

    // Check if PR body contains WIP markers
    if (
      pr.body &&
      (pr.body.toLowerCase().includes('wip') ||
        pr.body.toLowerCase().includes('work in progress') ||
        pr.body.toLowerCase().includes('do not review'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if PR is waiting for review
   */
  isWaitingForReview(pr: PullRequest): boolean {
    if (this.isWIP(pr)) {
      return false;
    }

    if (pr.merged_at !== null) {
      return false;
    }

    // Check if PR has been open for at least 1 hour
    const createdAt = new Date(pr.created_at);
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation < 1) {
      return false;
    }

    return true;
  }

  // https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
  async getOrgPRs(
    repo: string,
    params?: { isOpen?: boolean; isMerged?: boolean; reviewerId?: string },
  ): Promise<PullRequest[]> {
    const prs: PullRequest[] = [];

    const { isOpen = true, isMerged = true, reviewerId } = params || {};
    const reviewerFilter = reviewerId
      ? ` user-review-requested:${reviewerId}`
      : '';

    try {
      // Fetch open PRs
      if (isOpen) {
        const openQuery = `is:pr is:open org:${this.owner}${repo ? ` repo:${repo}` : ''}${reviewerFilter}`;
        const openPrs = await this.fetchPRs(openQuery);
        prs.push(...openPrs);
      }

      if (isMerged) {
        // Fetch closed PRs (to filter merged PRs)
        const closedQuery = `is:pr is:closed org:${this.owner}${repo ? ` repo:${repo}` : ''}${reviewerFilter}`;
        const closedPrs = await this.fetchPRs(closedQuery);

        // Filter out merged PRs
        const mergedPrsPromises = closedPrs.map(async (pr) => {
          const prDetails = await this.fetchPRDetails(pr);
          return prDetails.merged_at ? prDetails : null;
        });

        const mergedPrs = (await Promise.all(mergedPrsPromises)).filter(
          Boolean,
        ) as PullRequest[];

        // Combine open and merged PRs
        prs.push(...mergedPrs);
      }

      return prs;
    } catch (error) {
      console.error('Error fetching organization PRs:', error);
      throw error;
    }
  }

  // Helper function to fetch PRs from the GitHub search API
  private async fetchPRs(query: string): Promise<PullRequest[]> {
    const url = `${GITHUB_API_URL}/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    const searchData = await response.json();
    const prPromises = searchData.items.map(async (item: any) =>
      this.fetchPRDetails(item),
    );

    return Promise.all(prPromises);
  }

  // Helper function to fetch full PR details
  private async fetchPRDetails(item: any): Promise<PullRequest> {
    const urlParts = item.html_url.split('/');
    const repoName = urlParts[urlParts.length - 3];
    const prNumber = parseInt(urlParts[urlParts.length - 1], 10);
    const prUrl = `${GITHUB_API_URL}/repos/${this.owner}/${repoName}/pulls/${prNumber}`;

    const prResponse = await fetch(prUrl, { headers: this.headers });

    if (!prResponse.ok) {
      throw new Error(
        `GitHub API error: ${prResponse.status} ${prResponse.statusText}`,
      );
    }

    return prResponse.json();
  }
}

// Create the GitHubClient instance
export const githubClient = new GitHubClient();
