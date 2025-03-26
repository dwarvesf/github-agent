export interface PullRequest {
  number: number
  title: string
  url: string
  author: string
  createdAt: string
  updatedAt: string
  draft: boolean
  isWaitingForReview: boolean
  hasMergeConflicts: boolean
  isWIP: boolean
  isMerged: boolean
  labels: string[]
  reviewers: string[]
  hasComments: boolean
  hasReviews: boolean
}

interface Author {
  name: string
  email: string
  date: string
}

interface Tree {
  sha: string
  url: string
}

interface Verification {
  verified: boolean
  reason: string
  signature: string
  payload: string
  verified_at: string
}

interface CommitDetails {
  author: Author
  committer: Author
  message: string
  tree: Tree
  url: string
  comment_count: number
  verification: Verification
}

interface User {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  user_view_type: string
  site_admin: boolean
}

interface Parent {
  sha: string
  url: string
  html_url: string
}

interface Commit {
  sha: string
  node_id: string
  message: string
  commit: CommitDetails
  url: string
  html_url: string
  comments_url: string
  author: User
  committer: User
  parents: Parent[]
}
