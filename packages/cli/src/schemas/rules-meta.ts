import { z } from "zod";

/** Output schema for `taskless rule meta --json` on success */
export const outputSchema = z.object({
  id: z.string().describe("Rule ID"),
  ticketId: z.string().describe("Ticket ID that produced this rule"),
  generatedAt: z.string().describe("ISO 8601 generation timestamp"),
  schemaVersion: z.string().describe("Sidecar schema version"),
});

/** Error schema for `taskless rule meta --json` on failure */
export const errorSchema = z.object({
  error: z.string().describe("Error message"),
});
