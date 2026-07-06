declare const __VERSION__: string;

/**
 * The CLI's own version, injected at build time from `package.json` via the Vite
 * `__VERSION__` define. Falls back to `"unknown"` outside a build (e.g. tests).
 */
export const CLI_VERSION: string =
  typeof __VERSION__ === "string" ? __VERSION__ : "unknown";

/**
 * Header the CLI sends on every request to the Taskless service, declaring its
 * version so the service can gate capability-dependent responses (e.g. runtime
 * rules) on the CLI being new enough. A request without it is treated by the
 * service as a pre-runtime CLI.
 */
export const CLI_VERSION_HEADER = "x-taskless-cli-version";
