## Why

The CLI is currently a stub that prints a message. Skills need to invoke the CLI and parse structured output — starting with `/taskless:info`, which needs to retrieve the CLI version. The CLI needs an argument parser, a subcommand structure, and the info skill needs to be rewritten to actually invoke the CLI and interpret its JSON response.

## What Changes

- Add `citty` as a CLI dependency for subcommand-based argument parsing
- Replace the stub entry point with a citty-based CLI that shows help by default and supports subcommands
- Add `taskless info` subcommand that outputs `{"version":"<version>"}` as JSON to stdout
- Inject CLI version at build time via Vite `define` from `package.json`
- Rewrite `/taskless:info` SKILL.md to detect the package manager (lock file check), invoke the CLI via `pnpm dlx` or `npx`, parse the JSON response, and report the version
- Update CLI tests to cover the new subcommand behavior

## Capabilities

### New Capabilities

_None — no new spec capabilities are introduced._

### Modified Capabilities

- `cli`: The CLI stub entry point is replaced with a citty-based subcommand structure and the `info` subcommand
- `skills`: The info skill is rewritten to invoke the CLI and parse its JSON output

## Impact

- **`packages/cli/package.json`**: New `citty` dependency
- **`packages/cli/src/`**: Entry point rewritten with citty, new `info` command module
- **`packages/cli/vite.config.ts`**: Add `define` for `__VERSION__` from package.json
- **`plugins/taskless/skills/info/SKILL.md`**: Rewritten with CLI invocation instructions and JSON parsing
- **`packages/cli/test/`**: Tests updated for new subcommand behavior
