import type { CLIErrorCode } from "../types/errors";

/**
 * Sentinel error for expected CLI failures (e.g. validation errors).
 * The top-level catch in index.ts uses this to distinguish expected exits
 * (already printed their own output) from unexpected crashes.
 *
 * An optional `code` (a stable `CLIErrorCode`) lets the runner attribute a
 * `cli_error` telemetry event to a known failure mode. Omitting it is fine;
 * the runner falls back to `INTERNAL_ERROR`.
 */
export class CLIError extends Error {
  override name = "CLIError";
  readonly code?: CLIErrorCode;

  constructor(message?: string, code?: CLIErrorCode) {
    super(message);
    this.code = code;
  }
}
