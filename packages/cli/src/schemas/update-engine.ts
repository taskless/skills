import { z } from "zod";

/** Output schema for `taskless update-engine --json` on success */
export const outputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("current").describe("Scaffold is already up to date"),
  }),
  z.object({
    status: z.literal("exists").describe("An update PR already exists"),
    requestId: z.string().describe("Request ID for polling"),
    prUrl: z.string().describe("URL of the existing PR"),
  }),
  z.object({
    status: z.literal("open").describe("Update PR is open"),
    prUrl: z.string().describe("URL of the PR"),
  }),
  z.object({
    status: z.literal("merged").describe("Update PR was merged"),
    prUrl: z.string().describe("URL of the PR"),
  }),
  z.object({
    status: z.literal("closed").describe("Update PR was closed"),
    prUrl: z.string().describe("URL of the PR"),
  }),
]);

/** Error schema for `taskless update-engine --json` on failure */
export const errorSchema = z.object({
  error: z.string().describe("Error message"),
});
