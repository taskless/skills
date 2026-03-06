## Why

The CLI has no way to get detailed help for individual subcommands. Running `taskless help check` does nothing useful. Agent skills currently duplicate CLI usage documentation in their SKILL.md files instead of delegating to the CLI as the single source of truth. A `help` subcommand with rich embedded content lets both humans and agents get authoritative command documentation from one place.

## What Changes

- Add a `help` subcommand to the CLI that displays rich help text for any command or subcommand
- Embed help text files (`packages/cli/src/help/*.txt`) into the CLI bundle at build time via `import.meta.glob`
- Support nested command help: `taskless help auth login` resolves to `auth-login.txt`
- `taskless help` with no arguments lists all top-level commands with one-line descriptions
- Unknown command names produce a clear error with a pointer to `taskless help`

## Capabilities

### New Capabilities

- `cli-help`: Defines the `help` subcommand behavior, help file format, nesting resolution, and build-time embedding of help content

### Modified Capabilities

- `cli`: Add `help` as a registered subcommand alongside existing subcommands, and add the help directory to the Vite build embedding

## Impact

- `packages/cli/src/index.ts`: Register `help` subcommand
- `packages/cli/src/commands/help.ts`: New command file
- `packages/cli/src/help/*.txt`: New directory of help content files
- `packages/cli/vite.config.ts`: Embed help files via `import.meta.glob`
- Agent skills can later be simplified to delegate usage docs to `taskless help <command>`
