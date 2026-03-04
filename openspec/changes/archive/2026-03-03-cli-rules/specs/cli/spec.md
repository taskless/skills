## MODIFIED Requirements

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory, and a global `--json` boolean argument for machine-readable output. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies. The `check` subcommand, the `auth` subcommand group, and the `rules` subcommand group SHALL be registered alongside existing subcommands.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** the CLI is executed with no arguments
- **THEN** it SHALL print help text to stdout listing available subcommands including `rules`

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

#### Scenario: Auth subcommand group is registered

- **WHEN** a user runs `taskless auth`
- **THEN** the CLI SHALL route to the auth subcommand group

#### Scenario: Rules subcommand group is registered

- **WHEN** a user runs `taskless rules`
- **THEN** the CLI SHALL route to the rules subcommand group

## ADDED Requirements

### Requirement: Spec version compatibility includes rules generation range

The CLI SHALL add a new compatibility range that requires `orgId` and `repositoryUrl` in `.taskless/taskless.json`. The existing compatibility range for `check` SHALL remain valid. The `rules create` command SHALL validate that the project's spec version falls within the rules-compatible range.

#### Scenario: Old spec version works for check

- **WHEN** a project has a spec version in the existing `2026-02-18+` range
- **THEN** `taskless check` SHALL continue to work

#### Scenario: Old spec version rejected for rules create

- **WHEN** a project has a spec version that predates the rules-compatible range
- **THEN** `taskless rules create` SHALL print an error and exit with a non-zero exit code

#### Scenario: New spec version works for both check and rules

- **WHEN** a project has a spec version in the rules-compatible range
- **THEN** both `taskless check` and `taskless rules create` SHALL work

### Requirement: taskless.json supports orgId and repositoryUrl

The `.taskless/taskless.json` config file SHALL support `orgId` (number) and `repositoryUrl` (string) fields alongside the existing `version` field. These fields are required for API-dependent commands (`rules create`).

#### Scenario: taskless.json with all fields

- **WHEN** `.taskless/taskless.json` contains `{ "version": "...", "orgId": 12345, "repositoryUrl": "https://github.com/org/repo" }`
- **THEN** the CLI SHALL read all three fields successfully

#### Scenario: taskless.json with only version (legacy)

- **WHEN** `.taskless/taskless.json` contains only `{ "version": "..." }`
- **THEN** `taskless check` SHALL work but `taskless rules create` SHALL fail with a clear error
