## Why

The Taskless platform generates ast-grep rules via PRs into a `.taskless/` directory, but there is no local way to run those rules. Users need a `taskless check` command to execute their project's generated rules locally and in CI, completing the generation-to-enforcement loop.

## What Changes

- Add a `taskless check` subcommand that validates the `.taskless/` project setup and runs ast-grep rules against the codebase
- Add `@ast-grep/cli` as a dependency to provide the `sg` binary for rule scanning
- Add a `--json` global flag to the CLI for machine-readable output across all commands
- Introduce a scanner-agnostic result type and formatter layer that translates ast-grep output into Taskless-owned output formats (human-readable text by default, JSON stream when `--json` is passed)
- Exit code contract: 0 for clean/warnings, 1 for errors

## Capabilities

### New Capabilities
- `cli-check`: The `taskless check` subcommand — validates `.taskless/taskless.json` exists, checks for rules, executes `sg scan` via `@ast-grep/cli`, and formats results

### Modified Capabilities
- `cli`: Add the `check` subcommand to the main command's subcommands registry and add the global `--json` argument

## Impact

- **packages/cli/package.json**: New dependency on `@ast-grep/cli`
- **packages/cli/src/index.ts**: New `check` subcommand registration, new `--json` global arg
- **packages/cli/src/commands/**: New `check.ts` command file
- **packages/cli/src/actions/**: New scanner execution and result formatting logic
- **packages/cli/test/**: Tests for the check command
- **Existing commands** (`info`, `init`): May need to respect the new `--json` flag for consistent output behavior
