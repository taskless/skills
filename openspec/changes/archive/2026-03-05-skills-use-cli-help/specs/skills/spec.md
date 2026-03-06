## MODIFIED Requirements

### Requirement: Skills use SKILL.md format with YAML frontmatter

Each skill SHALL be defined in its own directory under `skills/<name>/` with a `SKILL.md` file containing YAML frontmatter (`name`, `description`, `metadata`) followed by markdown instructions. The `name` field SHALL use the `taskless-` prefix (e.g., `taskless-info`). The `metadata` field SHALL include `author` and `version` keys. The `version` key SHALL be used for staleness detection when skills are installed into target repositories.

Each skill's instructions SHALL begin by invoking `taskless help <command>` to retrieve the command's current usage documentation. The agent SHALL use this help output — including usage patterns, options, and examples — when constructing CLI invocations. Skills SHALL NOT hardcode CLI option lists, output format descriptions, or example commands that duplicate the help output. Skills SHALL prefer `pnpm dlx` when available but MAY use `npx` — the CLI works identically either way.

#### Scenario: Skill directory contains valid SKILL.md

- **WHEN** a new skill is added at `skills/<name>/SKILL.md`
- **THEN** it SHALL contain YAML frontmatter with `name` (kebab-case, 1-64 chars, starting with `taskless-`) and `description` (up to 1024 chars)
- **AND** the `metadata` field SHALL include `author: taskless` and `version` (string matching CLI package version)
- **AND** the markdown body SHALL contain instructions for the agent

#### Scenario: Skill name matches directory name

- **WHEN** a skill exists at `skills/taskless-info/SKILL.md`
- **THEN** the `name` field in frontmatter SHALL be `taskless-info`

#### Scenario: Skills are bundled into CLI at build time

- **WHEN** the CLI is built
- **THEN** all SKILL.md files under `skills/` SHALL be embedded into the CLI bundle
- **AND** the skill content SHALL be available at runtime without filesystem or network access

#### Scenario: Skill instructions begin with help invocation

- **WHEN** any skill's instructions are followed by an agent
- **THEN** the agent SHALL first run `taskless help <command>` to retrieve current command documentation
- **AND** the agent SHALL use the help output to understand usage, options, and examples

#### Scenario: Skills do not duplicate CLI help content

- **WHEN** a skill references CLI options, output formats, or example invocations
- **THEN** those details SHALL come from the `taskless help` output, not from hardcoded text in the SKILL.md

### Requirement: Info skill confirms Taskless is working

The `taskless-info` skill SHALL exist at `skills/taskless-info/SKILL.md`. When invoked, it SHALL run `taskless help info` to read current command documentation, invoke the CLI via `pnpm dlx @taskless/cli@latest info` (or `npx`), parse the JSON response, and report the CLI version. The skill SHALL confirm that Taskless is operational by displaying the version received from the CLI.

#### Scenario: Info skill reads help before invoking CLI

- **WHEN** the info skill is invoked
- **THEN** the agent SHALL run `taskless help info` to understand the command's output format
- **AND** then run `taskless info` to get the actual data

#### Scenario: Info skill invokes CLI and parses response

- **WHEN** the info skill runs the CLI
- **THEN** the agent SHALL run `pnpm dlx @taskless/cli@latest info` (preferring pnpm, falling back to npx)
- **AND** parse the JSON stdout to extract the `version` field
- **AND** report the version to the user

#### Scenario: Info skill handles CLI failure

- **WHEN** the CLI invocation fails (non-zero exit code or unparseable output)
- **THEN** the agent SHALL report that it could not reach the Taskless CLI and suggest troubleshooting steps

## ADDED Requirements

### Requirement: Check skill uses --json flag for machine-readable output

The `taskless-check` skill SHALL invoke the CLI with `--json` to get machine-readable output. The skill SHALL run `taskless help check` first to read current command documentation, then invoke `taskless check --json` and parse the JSON response.

#### Scenario: Check skill reads help and uses --json

- **WHEN** the check skill is invoked
- **THEN** the agent SHALL run `taskless help check` to understand the command
- **AND** then run `taskless check --json` to get results as JSON
- **AND** parse the JSON to determine success/failure and report results

### Requirement: Login skill delegates documentation to CLI help

The `taskless-login` skill SHALL run `taskless help auth login` to retrieve the current command documentation and present it to the user. The skill SHALL NOT attempt to run the login command itself, as it requires interactive terminal input.

#### Scenario: Login skill reads help and presents command

- **WHEN** the login skill is invoked
- **THEN** the agent SHALL run `taskless help auth login` to get current documentation
- **AND** present the login command for the user to run in their terminal
- **AND** SHALL NOT attempt to run the login command

### Requirement: Logout skill delegates documentation to CLI help

The `taskless-logout` skill SHALL run `taskless help auth logout` to retrieve the current command documentation and present it to the user. The skill SHALL NOT attempt to run the logout command itself.

#### Scenario: Logout skill reads help and presents command

- **WHEN** the logout skill is invoked
- **THEN** the agent SHALL run `taskless help auth logout` to get current documentation
- **AND** present the logout command for the user to run in their terminal
- **AND** SHALL NOT attempt to run the logout command

### Requirement: Rule create skill uses --json flag and delegates docs to help

The `taskless-rule-create` skill SHALL run `taskless help rules create` to read current command documentation, gather input from the user for the JSON payload, and invoke the CLI with `--json` for machine-readable output. The skill SHALL use examples from the help output to construct the CLI invocation.

#### Scenario: Rule create skill reads help before gathering input

- **WHEN** the rule create skill is invoked
- **THEN** the agent SHALL run `taskless help rules create` to understand the command's input format and options
- **AND** use the help output to understand required and optional JSON fields

#### Scenario: Rule create skill uses --json

- **WHEN** the rule create skill invokes the CLI
- **THEN** it SHALL pipe the JSON payload to `taskless rules create --json`

### Requirement: Rule delete skill delegates docs to help

The `taskless-rule-delete` skill SHALL run `taskless help rules delete` to read current command documentation before executing the delete command. The skill SHALL use the help output to understand the command's arguments and options.

#### Scenario: Rule delete skill reads help before executing

- **WHEN** the rule delete skill is invoked
- **THEN** the agent SHALL run `taskless help rules delete` to understand the command
- **AND** use the help output to construct the correct invocation with the rule ID
