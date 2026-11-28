/** Reads and writes one Big Picture item through the `gh` CLI. */
import { execFileSync } from "node:child_process";
import { graphql, PROJECT_ID } from "./github.ts";
import type { BoardIo, Change } from "./guard.ts";

const SETTLE_MS = 15_000;
const VALUES = `projectItems(first: 20) { nodes { id project { id }
  fieldValues(first: 50) { nodes { ... on ProjectV2ItemFieldSingleSelectValue {
    name field { ... on ProjectV2SingleSelectField { name } } } } } } }`;

interface Field {
  id?: string;
  name?: string;
  options?: { id: string; name: string }[];
}
interface Node {
  id: string;
  project: { id: string };
  fieldValues: { nodes: { name?: string; field?: { name: string } }[] };
}
interface Data {
  repository: {
    issueOrPullRequest: { state: string; projectItems: { nodes: Node[] } };
  };
  node: { fields: { nodes: Field[] } };
}

/** The `gh project item-edit` arguments that name one field and its value. */
function fieldArgs(change: Change, fields: Field[]): string[] {
  const field = fields.find((f) => f.name === change.field);
  if (!field?.id) {
    throw new Error(`no single-select field named "${change.field}"`);
  }
  if (change.value === null) return ["--field-id", field.id, "--clear"];
  const option = field.options?.find((o) => o.name === change.value);
  if (!option) {
    const valid = field.options?.map((o) => o.name).join(", ");
    throw new Error(`${change.field} has no "${change.value}". Use: ${valid}`);
  }
  return ["--field-id", field.id, "--single-select-option-id", option.id];
}

export function ghBoard(target: string): BoardIo {
  const found = /^([\w.-]+)#(\d+)$/.exec(target);
  if (!found) throw new Error(`expected <repo>#<number>, got "${target}"`);
  const [, repo, number] = found;
  const query = `query($repo: String!, $project: ID!) {
    repository(owner: "wazootech", name: $repo) {
      issueOrPullRequest(number: ${number}) {
        ... on Issue { state ${VALUES} }
        ... on PullRequest { state ${VALUES} }
      }
    }
    node(id: $project) { ... on ProjectV2 { fields(first: 50) { nodes {
      ... on ProjectV2SingleSelectField { id name options { id name } } } } } }
  }`;
  const fetch = () => {
    const data = graphql(query, { repo, project: PROJECT_ID }) as Data;
    const issue = data.repository.issueOrPullRequest;
    const item = issue.projectItems.nodes.find(
      (n) => n.project.id === PROJECT_ID,
    );
    if (!item) throw new Error(`${target} is not on the board`);
    return { state: issue.state, item, fields: data.node.fields.nodes };
  };
  return {
    read() {
      const { state, item } = fetch();
      const values = item.fieldValues.nodes.flatMap((v) =>
        v.field && v.name ? [[v.field.name, v.name]] : [],
      );
      return { state, values: Object.fromEntries(values) };
    },
    prepare(changes) {
      const { item, fields } = fetch();
      const edits = changes.map((change) => fieldArgs(change, fields));
      const base = ["project", "item-edit", "--project-id", PROJECT_ID];
      return () => {
        for (const edit of edits) {
          execFileSync("gh", [...base, "--id", item.id, ...edit], {
            stdio: ["ignore", "ignore", "pipe"],
          });
        }
      };
    },
    settle: () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS)),
  };
}
