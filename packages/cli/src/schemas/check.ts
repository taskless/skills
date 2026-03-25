import { z } from "zod";

/** Schema for a single check result */
export const checkResultSchema = z.object({
  source: z.string().describe("Scanner that produced this result"),
  ruleId: z.string().describe("Rule identifier"),
  severity: z
    .enum(["error", "warning", "info", "hint"])
    .describe("Severity level"),
  message: z.string().describe("Message explaining why the rule fired"),
  note: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .describe("Additional notes"),
  file: z.string().describe("File path where the match was found"),
  range: z.object({
    start: z.object({
      line: z.number(),
      column: z.number(),
    }),
    end: z.object({
      line: z.number(),
      column: z.number(),
    }),
  }),
  matchedText: z.string().describe("The code that matched the rule"),
  fix: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .describe("Suggested fix replacement"),
});

/** Output schema for `taskless check --json` on success */
export const outputSchema = z.object({
  success: z.literal(true),
  results: z.array(checkResultSchema).describe("Check results"),
});

/** Error schema for `taskless check --json` on failure */
export const errorSchema = z.object({
  success: z.literal(false),
  error: z.string().optional().describe("Error message"),
  results: z.array(checkResultSchema).describe("Check results (may be empty)"),
});
