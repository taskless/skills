import type { CliErrorCode } from "../types/errors";

/**
 * Sentinel error for expected CLI failures (e.g. validation errors).
 * The top-level catch in index.ts uses this to distinguish expected exits
 * (already printed their own output) from unexpected crashes.
 *
 * An optional `code` (a stable `CliErrorCode`) lets the runner attribute a
 * `cli_error` telemetry event to a known failure mode. Omitting it is fine;
 * the runner falls back to `INTERNAL_ERROR`.
 */
export class CliError extends Error {
  override name = "CliError";
  readonly code?: CliErrorCode;

  constructor(message?: string, code?: CliErrorCode) {
    super(message);
    this.code = code;
  }
}
