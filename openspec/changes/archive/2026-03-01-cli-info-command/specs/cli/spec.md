## MODIFIED Requirements

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** the CLI is executed with no arguments
- **THEN** it SHALL print help text to stdout listing available subcommands

#### Scenario: Running the CLI with an unknown subcommand shows help

- **WHEN** the CLI is executed with an unrecognized subcommand
- **THEN** it SHALL print help text to stdout

## ADDED Requirements

### Requirement: CLI info subcommand outputs version as JSON

The CLI SHALL support a `taskless info` subcommand that outputs a JSON object containing the CLI version to stdout. The version SHALL be injected at build time via Vite `define` from the CLI's `package.json` version field. The output SHALL be `{"version":"<version>"}` with no additional fields or formatting.

#### Scenario: Running taskless info outputs version JSON

- **WHEN** a user runs `taskless info`
- **THEN** stdout SHALL contain exactly `{"version":"<version>"}` where `<version>` matches the CLI's package.json version

#### Scenario: Info output is valid JSON

- **WHEN** a user runs `taskless info`
- **THEN** the stdout output SHALL be parseable by `JSON.parse()` and the resulting object SHALL have a `version` property of type string

### Requirement: CLI version is injected at build time

The CLI's `vite.config.ts` SHALL use the Vite `define` option to replace a `__VERSION__` sentinel with the version string read from `packages/cli/package.json` at build time. No runtime file reads or import assertions SHALL be used for version resolution.

#### Scenario: Build replaces version sentinel

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** all occurrences of `__VERSION__` in source code SHALL be replaced with the literal version string from package.json

### Requirement: citty is the argument parser

The CLI SHALL use `citty` as its sole argument parsing dependency. Each subcommand SHALL be defined as an isolated command object and registered with the main CLI via `defineCommand` and `runMain`.

#### Scenario: citty is declared as a dependency

- **WHEN** inspecting `packages/cli/package.json`
- **THEN** `citty` SHALL be listed in `dependencies`
