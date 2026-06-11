import { z } from "zod";

/** A linter detected from configuration on disk */
const detectedLinterSchema = z.object({
  name: z.string().describe("Linter identifier, e.g. eslint, ruff, rubocop"),
  configFiles: z
    .array(z.string())
    .describe("Repo-relative config paths that evidenced this linter"),
});

/** A surfaced style of the repo's own existing rules */
const ruleStyleSchema = z.object({
  source: z
    .string()
    .describe("Where the existing rules live, e.g. .taskless/rules"),
  description: z
    .string()
    .describe("How the repo authors rules of this kind, for downstream reuse"),
});

/** Output schema for `taskless detect --json` on success */
export const outputSchema = z.object({
  success: z.literal(true),
  linters: z
    .array(detectedLinterSchema)
    .describe("Linters configured in the working directory"),
  languages: z
    .array(z.string())
    .describe("Languages inferred from manifests and source signals"),
  frameworks: z
    .array(z.string())
    .describe("Frameworks inferred from dependency manifests"),
  ruleStyles: z
    .array(ruleStyleSchema)
    .describe("Styles of the repo's own existing rules"),
});

/** Error schema for `taskless detect --json` on failure */
export const errorSchema = z.object({
  success: z.literal(false),
  error: z.string().describe("Error message"),
});
