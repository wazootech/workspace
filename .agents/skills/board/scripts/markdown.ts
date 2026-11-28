/** Markdown pieces shared by the checks. */
export function link(url: string): string {
  const parts = url.split("/");
  return `[${parts.at(-3)}#${parts.at(-1)}](${url})`;
}

export function listing(title: string, rows: string[]): string {
  return [`### ${title}: ${rows.length}`, ...rows].join("\n");
}

export function section(title: string, urls: string[]): string {
  return listing(
    title,
    [...urls].sort().map((url) => `- ${link(url)}`),
  );
}

export const notRun = (title: string, reason: string) =>
  `### ${title}: NOT RUN\n${reason}`;
