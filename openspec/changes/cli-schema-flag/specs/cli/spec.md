## MODIFIED Requirements

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory, a global `--json` boolean argument for machine-readable output, and a global `--schema` boolean argument for printing JSON Schema definitions. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies. The `check` subcommand, the `auth` subcommand group, the `rules` subcommand group, the `update-engine` subcommand, and the `help` subcommand SHALL be registered alongside existing subcommands. The `update` alias for `init` SHALL be removed.

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

#### Scenario: Global --schema flag is accepted

- **WHEN** the CLI is executed with `--schema`
- **THEN** the flag SHALL be available to all subcommands as `args.schema`

#### Scenario: --schema defaults to false

- **WHEN** a user runs a subcommand without `--schema`
- **THEN** `args.schema` SHALL be `false`

#### Scenario: --schema is ignored by commands without --json support

- **WHEN** a user runs `taskless auth login --schema`
- **THEN** the CLI SHALL ignore the `--schema` flag and proceed normally

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
