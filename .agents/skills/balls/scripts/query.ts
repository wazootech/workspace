/**
 * One compact search page: enough metadata to classify an item without paying
 * for every comment in the org. `--detail` loads the whole thread separately.
 *
 * `first: 100` is GitHub's page maximum. The `last: 5` and `first: 10` caps
 * bound each candidate; `users(first: 10)` is enough to spot a viewer reaction
 * without pulling every reactor.
 */
export const SEARCH_QUERY = `
query Balls($search: String!, $after: String) {
  search(query: $search, type: ISSUE, first: 100, after: $after) {
    nodes {
      __typename
      ... on Issue {
        number title url createdAt updatedAt closed
        repository { nameWithOwner isArchived }
        author { login __typename }
        assignees(first: 10) { nodes { login } }
        reactionGroups { content users(first: 10) { nodes { login } } }
        comments(last: 5) {
          nodes {
            author { login __typename }
            body createdAt
            reactionGroups { content users(first: 10) { nodes { login } } }
          }
        }
      }
      ... on PullRequest {
        number title url createdAt updatedAt closed merged mergeable isDraft
        repository { nameWithOwner isArchived }
        author { login __typename }
        assignees(first: 10) { nodes { login } }
        reactionGroups { content users(first: 10) { nodes { login } } }
        reviewRequests(first: 10) {
          nodes {
            requestedReviewer {
              ... on User { login }
              ... on Team { name }
            }
          }
        }
        statusCheckRollup { state }
        reviews(last: 5) {
          nodes { author { login __typename } body state createdAt }
        }
        comments(last: 5) {
          nodes {
            author { login __typename }
            body createdAt
            reactionGroups { content users(first: 10) { nodes { login } } }
          }
        }
        reviewThreads(first: 10) {
          nodes {
            isResolved
            comments(last: 5) {
              nodes { author { login __typename } body createdAt }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;
