## ADDED Requirements

### Requirement: Help subcommand displays rich help text for commands

The CLI SHALL support a `help` subcommand that accepts zero or more positional arguments identifying a command path. When arguments are provided, the help subcommand SHALL look up a matching help text file embedded at build time and print its contents to stdout. When no arguments are provided, the help subcommand SHALL print a command index listing all top-level commands with their descriptions.

#### Scenario: Help for a top-level command

- **WHEN** a user runs `taskless help check`
- **THEN** the CLI SHALL print the contents of the `check` help file to stdout

#### Scenario: Help for a nested subcommand

- **WHEN** a user runs `taskless help auth login`
- **THEN** the CLI SHALL join the arguments with `-` to form the key `auth-login`
- **AND** print the contents of the `auth-login` help file to stdout

#### Scenario: Help for a command group

- **WHEN** a user runs `taskless help auth`
- **THEN** the CLI SHALL print the contents of the `auth` help file to stdout

#### Scenario: Help with no arguments lists all commands

- **WHEN** a user runs `taskless help`
- **THEN** the CLI SHALL print a command index listing each top-level command name and its description

#### Scenario: Help for unknown command shows error

- **WHEN** a user runs `taskless help nonexistent`
- **THEN** the CLI SHALL print an error message indicating the command is not recognized
- **AND** suggest running `taskless help` for available commands

### Requirement: Help text files are embedded at build time

Help text files SHALL be located at `packages/cli/src/help/` as plain `.txt` files. The Vite build SHALL embed these files into the CLI bundle via `import.meta.glob` with raw imports. A help file SHALL exist for every registered command and subcommand.

#### Scenario: Help files are available without filesystem access

- **WHEN** the CLI is invoked via `npx @taskless/cli help check`
- **THEN** the help text SHALL be served from the embedded bundle without reading the filesystem

#### Scenario: Help file naming convention

- **WHEN** a help file is created for the `rules create` subcommand
- **THEN** the file SHALL be named `rules-create.txt` in `packages/cli/src/help/`

### Requirement: Help text files follow a consistent format

Each help text file SHALL begin with a one-line summary of the command, followed by a blank line, then structured sections. The sections MAY include any of: a longer description, Prerequisites, Usage, Options, Output, Exit Codes, and Examples. Section headers SHALL be followed by a colon and content on subsequent indented lines.

#### Scenario: Help file has summary and usage

- **WHEN** a help text file is read
- **THEN** the first line SHALL be a brief summary of the command
- **AND** the file SHALL contain a `Usage:` section showing the invocation pattern
