# CLI

## Purpose

TBD — Defines the structure and build requirements for the `@taskless/cli` package.

## Requirements

### Requirement: CLI package exists at packages/cli

The `@taskless/cli` package SHALL exist at `packages/cli/` with its own `package.json` declaring the package name `@taskless/cli`.

#### Scenario: Package is discoverable by pnpm workspace

- **WHEN** `pnpm-workspace.yaml` declares `packages/*`
- **THEN** pnpm SHALL resolve `@taskless/cli` as a workspace package at `packages/cli/`

### Requirement: CLI has a bin entry point

The package SHALL declare a `bin` field in `package.json` pointing to the built output. The built file SHALL include a Node.js shebang (`#!/usr/bin/env node`).

#### Scenario: CLI is executable via npx

- **WHEN** a user runs `npx @taskless/cli`
- **THEN** Node.js SHALL execute the bin entry point

#### Scenario: CLI is executable via pnpm dlx

- **WHEN** a user runs `pnpm dlx @taskless/cli`
- **THEN** Node.js SHALL execute the bin entry point

### Requirement: CLI builds with Vite

The CLI SHALL use Vite in library mode to produce a single bundled ESM output file. The build configuration SHALL live in `packages/cli/vite.config.ts`.

#### Scenario: Build produces executable output

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** Vite SHALL produce a single file in `dist/` that is a valid Node.js ESM module with a shebang

### Requirement: CLI TypeScript config extends base

The CLI SHALL have a `packages/cli/tsconfig.json` that extends `../../tsconfig.base.json`. It SHALL add any CLI-specific compiler options without duplicating base settings.

#### Scenario: Type checking passes independently

- **WHEN** `pnpm typecheck` is run in `packages/cli/`
- **THEN** `tsc` SHALL pass with no errors using the extended config

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory, and a global `--json` boolean argument for machine-readable output. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies. The `check` subcommand SHALL be registered alongside existing subcommands.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** the CLI is executed with no arguments
- **THEN** it SHALL print help text to stdout listing available subcommands

#### Scenario: Running the CLI with an unknown subcommand shows help

- **WHEN** the CLI is executed with an unrecognized subcommand
- **THEN** it SHALL print help text to stdout

#### Scenario: Global -d flag is accepted

- **WHEN** the CLI is executed with `-d /some/path` or `--dir /some/path`
- **THEN** the specified path SHALL be available to all subcommands as the resolved working directory

#### Scenario: Working directory defaults to process.cwd()

- **WHEN** the CLI is executed without the `-d` flag
- **THEN** the working directory SHALL default to `process.cwd()`

#### Scenario: Global --json flag is accepted

- **WHEN** the CLI is executed with `--json`
- **THEN** the flag SHALL be available to all subcommands as `args.json`

#### Scenario: --json defaults to false

- **WHEN** a user runs a subcommand without `--json`
- **THEN** `args.json` SHALL be `false`

#### Scenario: Check subcommand is registered

- **WHEN** a user runs `taskless check`
- **THEN** the CLI SHALL route to the check subcommand handler

### Requirement: CLI info subcommand outputs version as JSON

The CLI SHALL support a `taskless info` subcommand that outputs a JSON object to stdout. The object SHALL contain the CLI `version` and a `tools` array. Each entry in `tools` SHALL include the tool name, a list of installed skills with their versions, and whether each skill is current or outdated compared to the CLI's bundled version. When no tool directories are detected, the `tools` array SHALL be empty.

#### Scenario: Running taskless info outputs version and tool status

- **WHEN** a user runs `taskless info` in a repository with Claude Code installed and taskless skills present
- **THEN** stdout SHALL contain a JSON object with `version` (string) and `tools` (array)
- **AND** the `tools` array SHALL include an entry for Claude Code with installed skill versions and staleness status

#### Scenario: Info output is valid JSON

- **WHEN** a user runs `taskless info`
- **THEN** the stdout output SHALL be parseable by `JSON.parse()`
- **AND** the resulting object SHALL have a `version` property of type string and a `tools` property of type array

#### Scenario: Info with no tools detected

- **WHEN** a user runs `taskless info` in a directory with no tool directories
- **THEN** the `tools` array in the output SHALL be empty

#### Scenario: Info reports outdated skills

- **WHEN** an installed skill has a `metadata.version` that differs from the CLI's bundled version
- **THEN** the tool entry SHALL indicate the skill is outdated with both the installed and current versions

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
