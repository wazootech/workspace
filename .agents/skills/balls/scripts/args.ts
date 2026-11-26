/** Command-line arguments for the collector. */

export interface Args {
  /** Whose court to look in; undefined means the authenticated user. */
  user?: string;
  scope: string;
}

// GitHub logins: alphanumerics and hyphens, 39 characters at most.
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

export function parseArgs(argv: string[]): Args {
  const rest = [...argv];
  let user: string | undefined;
  const flag = rest.indexOf("--user");
  if (flag !== -1) {
    user = rest[flag + 1]?.replace(/^@/, "");
    if (user === undefined || !LOGIN.test(user)) {
      throw new Error("--user expects a GitHub login");
    }
    rest.splice(flag, 2);
  }
  const unknown = rest.find((a) => a.startsWith("--"));
  if (unknown !== undefined) throw new Error(`unknown option ${unknown}`);
  if (rest.length > 1) throw new Error("expected at most one owner/repo scope");
  return { user, scope: rest[0] ?? "wazootech" };
}
