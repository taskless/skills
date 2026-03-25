import { z } from "zod";

/** Input schema for `taskless rules improve --from` JSON file */
export const inputSchema = z.object({
  ruleId: z
    .string()
    .min(1, "ruleId must be a non-empty string")
    .describe("ID of the rule to improve"),
  guidance: z
    .string()
    .min(1, "guidance must be a non-empty string")
    .describe("Feedback for iterating on the existing rule"),
  references: z
    .array(
      z.object({
        filename: z.string().describe("File path relative to .taskless/"),
        content: z.string().describe("File content"),
      })
    )
    .optional()
    .describe("Reference files to include as context"),
});

/** Output schema for `taskless rules improve --json` on success */
export const outputSchema = z.object({
  success: z.literal(true),
  requestId: z.string().describe("The request ID for polling status"),
  rules: z.array(z.string()).describe("Rule IDs that were updated"),
  files: z.array(z.string()).describe("File paths that were written"),
});

/** Error schema for `taskless rules improve --json` on failure */
export const errorSchema = z.object({
  error: z.string().describe("Error message"),
});
