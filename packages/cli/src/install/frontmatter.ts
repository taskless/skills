import { parse } from "yaml";

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
