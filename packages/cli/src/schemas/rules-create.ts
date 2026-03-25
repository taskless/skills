import { z } from "zod";

/** Input schema for `taskless rules create --from` JSON file */
export const inputSchema = z.object({
  prompt: z
    .string()
    .min(1, "prompt must be a non-empty string")
    .describe("Description of the rule to generate"),
  successCases: z
    .array(z.string())
    .optional()
    .describe("Examples of correct code that should pass the rule"),
  failureCases: z
    .array(z.string())
    .optional()
    .describe("Examples of incorrect code that should fail the rule"),
});

/** Output schema for `taskless rules create --json` on success */
export const outputSchema = z.object({
  success: z.literal(true),
  ruleId: z.string().describe("UUID of the generated rule job"),
  rules: z.array(z.string()).describe("Rule IDs that were generated"),
  files: z.array(z.string()).describe("File paths that were written"),
});

/** Error schema for `taskless rules create --json` on failure */
export const errorSchema = z.object({
  error: z.string().describe("Error message"),
});
