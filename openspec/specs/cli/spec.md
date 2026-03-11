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

The CLI SHALL use Vite in library mode to produce a single bundled ESM output file. The build configuration SHALL live in `packages/cli/vite.config.ts`. The Vite build SHALL embed skills from `skills/`, commands from `commands/taskless/`, and help text files from `packages/cli/src/help/` via `import.meta.glob` with raw file imports. The build SHALL assert that every embedded skill's `metadata.version` matches the CLI's `package.json` version, failing with an error if any mismatch is detected.

#### Scenario: Build produces executable output

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** Vite SHALL produce a single file in `dist/` that is a valid Node.js ESM module with a shebang

#### Scenario: Build embeds skills from skills directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `SKILL.md` file under `skills/` at the repo root SHALL be embedded in the output bundle

#### Scenario: Build embeds commands from commands directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `.md` file under `commands/taskless/` at the repo root SHALL be embedded in the output bundle

#### Scenario: Build embeds help text files

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `.txt` file under `packages/cli/src/help/` SHALL be embedded in the output bundle

#### Scenario: Build fails on version mismatch

- **WHEN** any embedded SKILL.md has a `metadata.version` that differs from `packages/cli/package.json` version
- **THEN** the Vite build SHALL fail with an error identifying the mismatched skill(s)

### Requirement: CLI TypeScript config extends base

The CLI SHALL have a `packages/cli/tsconfig.json` that extends `../../tsconfig.base.json`. It SHALL add any CLI-specific compiler options without duplicating base settings.

#### Scenario: Type checking passes independently

- **WHEN** `pnpm typecheck` is run in `packages/cli/`
- **THEN** `tsc` SHALL pass with no errors using the extended config

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory, and a global `--json` boolean argument for machine-readable output. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies. The `check` subcommand, the `auth` subcommand group, the `rules` subcommand group, the `update-engine` subcommand, and the `help` subcommand SHALL be registered alongside existing subcommands. The `update` alias for `init` SHALL be removed.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** the CLI is executed with no arguments
- **THEN** it SHALL print help text to stdout listing available subcommands including `help`

#### Scenario: Running the CLI with an unknown subcommand shows help

- **WHEN** the CLI is executed with an unrecognized subcommand
- **THEN** it SHALL print help text to stdout

#### Scenario: Update-engine subcommand is registered

- **WHEN** a user runs `taskless update-engine`
- **THEN** the CLI SHALL route to the update-engine subcommand handler

#### Scenario: Init subcommand remains unchanged

- **WHEN** a user runs `taskless init`
- **THEN** the CLI SHALL route to the init subcommand handler
- **AND** the init handler SHALL NOT perform scaffold updates

#### Scenario: Update alias is removed

- **WHEN** a user runs `taskless update`
- **THEN** the CLI SHALL NOT route to the init handler
- **AND** SHALL show help text (unrecognized subcommand)

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

#### Scenario: Auth subcommand group is registered

- **WHEN** a user runs `taskless auth`
- **THEN** the CLI SHALL route to the auth subcommand group

#### Scenario: Rules subcommand group is registered

- **WHEN** a user runs `taskless rules`
- **THEN** the CLI SHALL route to the rules subcommand group

#### Scenario: Help subcommand is registered

- **WHEN** a user runs `taskless help`
- **THEN** the CLI SHALL route to the help subcommand handler

### Requirement: Per-subcommand minimum scaffold version map

The CLI SHALL maintain a `MIN_SCAFFOLD_VERSION` map that declares the minimum `.taskless/taskless.json` version required for each subcommand. The map SHALL be a `Record<string, string>` keyed by subcommand name (e.g., `'rules create'`, `'check'`). This map replaces the `COMPATIBILITY` ranges, `RULES_MIN_SPEC_VERSION`, and `isRulesCompatibleVersion()`.

#### Scenario: Map contains entry for rules create

- **WHEN** inspecting `MIN_SCAFFOLD_VERSION`
- **THEN** the entry for `'rules create'` SHALL be `'2026-03-02'`

#### Scenario: Map contains entry for check

- **WHEN** inspecting `MIN_SCAFFOLD_VERSION`
- **THEN** the entry for `'check'` SHALL be `'2026-02-18'`

#### Scenario: New subcommands raise the floor as needed

- **WHEN** a new subcommand requires a newer scaffold version
- **THEN** a new entry SHALL be added to `MIN_SCAFFOLD_VERSION` with the appropriate minimum

### Requirement: Subcommand scaffold version validation is purely local

On every subcommand invocation that has an entry in `MIN_SCAFFOLD_VERSION`, the CLI SHALL read `version` from `.taskless/taskless.json` and compare it against the subcommand's minimum using string comparison. If the version is below the minimum, the CLI SHALL fast-fail with a message identifying the current version, the required version, and the subcommand name, and SHALL direct the user to run `taskless update-engine`.

#### Scenario: Version below minimum

- **WHEN** a user runs `taskless rules create` and `.taskless/taskless.json` has version `2026-03-01`
- **THEN** the CLI SHALL print: "Scaffold version 2026-03-01 is below the minimum 2026-03-02 required for 'taskless rules create'. Run 'taskless update-engine' to update."
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Version at minimum

- **WHEN** a user runs `taskless rules create` and `.taskless/taskless.json` has version `2026-03-02`
- **THEN** the CLI SHALL proceed normally

#### Scenario: Version above minimum

- **WHEN** a user runs `taskless rules create` and `.taskless/taskless.json` has version `2026-04-01`
- **THEN** the CLI SHALL proceed normally

#### Scenario: No API calls for version checking

- **WHEN** the CLI validates the scaffold version for any subcommand
- **THEN** the CLI SHALL NOT make any network requests to determine compatibility

### Requirement: COMPATIBILITY ranges and RULES_MIN_SPEC_VERSION are removed

The `COMPATIBILITY` array, `RULES_MIN_SPEC_VERSION` constant, `isRulesCompatibleVersion()` function, and `isSupportedSpecVersion()` function SHALL be removed from `capabilities.ts`. The `isValidSpecVersion()` function SHALL be retained as it validates the YYYY-MM-DD format independently.

#### Scenario: Old compatibility exports are removed

- **WHEN** inspecting `packages/cli/src/capabilities.ts`
- **THEN** it SHALL NOT export `COMPATIBILITY`, `RULES_MIN_SPEC_VERSION`, `isRulesCompatibleVersion`, or `isSupportedSpecVersion`

#### Scenario: isValidSpecVersion is retained

- **WHEN** inspecting `packages/cli/src/capabilities.ts`
- **THEN** it SHALL continue to export `isValidSpecVersion()`

### Requirement: validateRulesConfig uses per-subcommand version check

The `validateRulesConfig()` function in `project-config.ts` SHALL use the per-subcommand minimum version check instead of `isRulesCompatibleVersion()`. The error message SHALL reference `taskless update-engine` and include the current and required versions.

#### Scenario: Stale version error message includes versions

- **WHEN** `validateRulesConfig()` detects a version below the minimum for `'rules create'`
- **THEN** the error message SHALL include the current version, the required version, and "Run 'taskless update-engine' to update."

### Requirement: taskless.json supports orgId and repositoryUrl

The `.taskless/taskless.json` config file SHALL support `orgId` (number) and `repositoryUrl` (string) fields alongside the existing `version` field. These fields are required for API-dependent commands (`rules create`).

#### Scenario: taskless.json with all fields

- **WHEN** `.taskless/taskless.json` contains `{ "version": "...", "orgId": 12345, "repositoryUrl": "https://github.com/org/repo" }`
- **THEN** the CLI SHALL read all three fields successfully

#### Scenario: taskless.json with only version (legacy)

- **WHEN** `.taskless/taskless.json` contains only `{ "version": "..." }`
- **THEN** `taskless check` SHALL work but `taskless rules create` SHALL fail with a clear error

### Requirement: CLI info subcommand outputs version as JSON

The CLI SHALL support a `taskless info` subcommand that outputs a JSON object to stdout. The object SHALL contain the CLI `version`, a `tools` array, and a `loggedIn` boolean. The `loggedIn` field SHALL be `true` when a token is available (via `TASKLESS_TOKEN` env var or token file) and `false` otherwise. Each entry in `tools` SHALL include the tool name, a list of installed skills with their versions, and whether each skill is current or outdated compared to the CLI's bundled version. When no tool directories are detected, the `tools` array SHALL be empty.

#### Scenario: Running taskless info outputs version, tool status, and login status

- **WHEN** a user runs `taskless info` in a repository with Claude Code installed and taskless skills present
- **THEN** stdout SHALL contain a JSON object with `version` (string), `tools` (array), and `loggedIn` (boolean)
- **AND** the `tools` array SHALL include an entry for Claude Code with installed skill versions and staleness status

#### Scenario: Info output is valid JSON

- **WHEN** a user runs `taskless info`
- **THEN** the stdout output SHALL be parseable by `JSON.parse()`
- **AND** the resulting object SHALL have a `version` property of type string, a `tools` property of type array, and a `loggedIn` property of type boolean

#### Scenario: Info with no tools detected

- **WHEN** a user runs `taskless info` in a directory with no tool directories
- **THEN** the `tools` array in the output SHALL be empty

#### Scenario: Info reports outdated skills

- **WHEN** an installed skill has a `metadata.version` that differs from the CLI's bundled version
- **THEN** the tool entry SHALL indicate the skill is outdated with both the installed and current versions

#### Scenario: Info reports logged in when token exists

- **WHEN** a token is available via `TASKLESS_TOKEN` env var or token file
- **THEN** `loggedIn` SHALL be `true`

#### Scenario: Info reports not logged in when no token

- **WHEN** no token is available
- **THEN** `loggedIn` SHALL be `false`

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
