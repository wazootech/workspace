/** GraphQL queries for the board audit. */
export const BOARD_QUERY = `
query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          isArchived
          status: fieldValueByName(name: "Status") { ...Pick }
          priority: fieldValueByName(name: "Priority") { ...Pick }
          signal: fieldValueByName(name: "Signal") { ...Pick }
          content {
            __typename
            ... on Issue {
              url state updatedAt
              closedByPullRequestsReferences(
                first: 20, includeClosedPrs: true
              ) { nodes { url state } }
            }
            ... on PullRequest { url state updatedAt }
          }
        }
      }
    }
  }
}
fragment Pick on ProjectV2ItemFieldValue {
  ... on ProjectV2ItemFieldSingleSelectValue { name }
}`;

export const OPEN_ISSUES_QUERY = `
query($search: String!, $after: String) {
  search(query: $search, type: ISSUE, first: 100, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on Issue { url } }
  }
}`;
