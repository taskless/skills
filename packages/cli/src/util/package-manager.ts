/**
 * Detect the package manager that invoked the CLI from the
 * npm_config_user_agent environment variable and return the
 * appropriate `dlx`-style prefix for error messages.
 *
 * Falls back to `npx` when detection is not possible.
 */
export function getCliPrefix(): string {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm/")) return "pnpm dlx @taskless/cli@latest";
  if (ua.startsWith("yarn/")) return "yarn dlx @taskless/cli@latest";
  if (ua.startsWith("bun/")) return "bunx @taskless/cli@latest";
  return "npx @taskless/cli@latest";
}
