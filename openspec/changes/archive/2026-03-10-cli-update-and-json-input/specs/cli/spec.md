## ADDED Requirements

### Requirement: Per-subcommand minimum scaffold version map

The CLI SHALL maintain a `MIN_SCAFFOLD_VERSION` map that declares the minimum `.taskless/taskless.json` version required for each subcommand. The map SHALL be a `Record<string, string>` keyed by subcommand name (e.g., `'rules create'`, `'check'`). This map replaces the `COMPATIBILITY` ranges, `RULES_MIN_SPEC_VERSION`, and `isRulesCompatibleVersion()`.

#### Scenario: Map contains entry for rules create

- **WHEN** inspecting `MIN_SCAFFOLD_VERSION`
- **THEN** the entry for `'rules create'` SHALL be `'2026-03-03'`

#### Scenario: Map contains entry for check

- **WHEN** inspecting `MIN_SCAFFOLD_VERSION`
- **THEN** the entry for `'check'` SHALL be `'2026-02-18'`

#### Scenario: New subcommands raise the floor as needed

- **WHEN** a new subcommand requires a newer scaffold version
- **THEN** a new entry SHALL be added to `MIN_SCAFFOLD_VERSION` with the appropriate minimum

### Requirement: Subcommand scaffold version validation is purely local

On every subcommand invocation that has an entry in `MIN_SCAFFOLD_VERSION`, the CLI SHALL read `version` from `.taskless/taskless.json` and compare it against the subcommand's minimum using string comparison. If the version is below the minimum, the CLI SHALL fast-fail with a message identifying the current version, the required version, and the subcommand name, and SHALL direct the user to run `taskless update-engine`.

#### Scenario: Version below minimum

- **WHEN** a user runs `taskless rules create` and `.taskless/taskless.json` has version `2026-03-02`
- **THEN** the CLI SHALL print: "Scaffold version 2026-03-02 is below the minimum 2026-03-03 required for 'taskless rules create'. Run 'taskless update-engine' to update."
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Version at minimum

- **WHEN** a user runs `taskless rules create` and `.taskless/taskless.json` has version `2026-03-03`
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

## MODIFIED Requirements

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
