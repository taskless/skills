## MODIFIED Requirements

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies.

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
