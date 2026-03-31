import { parse, stringify } from "yaml";

interface Frontmatter {
  data: Record<string, unknown>;
  content: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/** Parse YAML frontmatter from a string. Returns data and body content. */
export function parseFrontmatter(source: string): Frontmatter {
  const match = FRONTMATTER_REGEX.exec(source);
  if (!match) return { data: {}, content: source };
  return {
    data: (parse(match[1] ?? "") ?? {}) as Record<string, unknown>,
    content: match[2] ?? "",
  };
}

/** Serialize data as YAML frontmatter prepended to a body string. */
export function stringifyFrontmatter(
  body: string,
  data: Record<string, unknown>
): string {
  return `---\n${stringify(data, { lineWidth: 0 })}---\n${body}`;
}
