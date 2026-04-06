/**
 * Sentinel error for expected CLI failures (e.g. validation errors).
 * The top-level catch in index.ts uses this to distinguish expected exits
 * (already printed their own output) from unexpected crashes.
 */
export class CliError extends Error {
  override name = "CliError";
}
