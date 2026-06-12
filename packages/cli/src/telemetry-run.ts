import { resolve } from "node:path";

import type { TelemetryClient } from "./telemetry";
import { CliError } from "./util/cli-error";

/**
 * Derive the cli_run `command` property from the raw argv. Flags (and the
 * value after `-d`/`--dir`) are skipped; the first positional is the command,
 * and `rule` keeps its subcommand (e.g. `rule create`) since that distinction
 * is meaningful. `help`'s topic is recorded separately on cli_help, so the
 * command for a help invocation is just `help`.
 */
export function resolveCommandName(rawArguments: string[]): string {
  const valueFlags = new Set(["-d", "--dir"]);
  const positionals: string[] = [];
  for (let index = 0; index < rawArguments.length; index++) {
    const argument = rawArguments[index]!;
    if (argument.startsWith("-")) {
      if (!argument.includes("=") && valueFlags.has(argument)) index++;
      continue;
    }
    positionals.push(argument);
  }

  if (positionals.length === 0) return "(default)";
  const top = positionals[0]!;
  if (top === "rule" && positionals[1]) return `rule ${positionals[1]}`;
  return top;
}

/** Resolve the working directory from `-d`/`--dir`, defaulting to cwd. */
export function resolveCwd(rawArguments: string[]): string {
  for (let index = 0; index < rawArguments.length; index++) {
    const argument = rawArguments[index]!;
    if (
      (argument === "-d" || argument === "--dir") &&
      rawArguments[index + 1]
    ) {
      return resolve(rawArguments[index + 1]!);
    }
    if (argument.startsWith("--dir=")) {
      return resolve(argument.slice("--dir=".length));
    }
  }
  return process.cwd();
}

export interface RunContext {
  command: string;
  success: boolean;
  durationMs: number;
  error?: unknown;
}

/**
 * Emit the per-invocation telemetry: a single `cli_run` denominator event
 * (always), preceded by `cli_error` when the invocation failed. The CLI
 * version rides along via the telemetry client's standard `cliVersion`
 * property; `cli_version` is included here in the snake_case form the run
 * taxonomy uses.
 */
export function emitRunEvents(
  telemetry: Pick<TelemetryClient, "capture" | "identity">,
  context: RunContext
): void {
  if (!context.success) {
    const code =
      context.error instanceof CliError && context.error.code
        ? context.error.code
        : "INTERNAL_ERROR";
    telemetry.capture("cli_error", { command: context.command, code });
  }

  telemetry.capture("cli_run", {
    command: context.command,
    cli_version: __VERSION__,
    success: context.success,
    durationMs: context.durationMs,
    anonymous: telemetry.identity.anonymous,
    loggedIn: !telemetry.identity.anonymous,
  });
}
