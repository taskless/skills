# Skills

## Purpose

TBD — Defines the structure and conventions for Taskless skills within the Claude Code plugin marketplace.

## Requirements

### Requirement: Claude Code plugin marketplace structure

The repository SHALL include a `.claude-plugin/marketplace.json` at the root that registers the `taskless` plugin. The `plugins/taskless/` directory SHALL contain a `.claude-plugin/plugin.json` manifest and a `skills/` directory for individual skill definitions.

#### Scenario: Marketplace manifest registers the plugin

- **WHEN** a Claude Code client reads `.claude-plugin/marketplace.json`
- **THEN** it SHALL find a plugin entry with name `taskless` and source pointing to `./plugins/taskless`

#### Scenario: Plugin manifest is valid

- **WHEN** a Claude Code client reads `plugins/taskless/.claude-plugin/plugin.json`
- **THEN** it SHALL find a valid plugin manifest with the plugin name `taskless`

### Requirement: Skills use SKILL.md format with YAML frontmatter

Each skill SHALL be defined in its own directory under `plugins/taskless/skills/<name>/` with a `SKILL.md` file containing YAML frontmatter (`name`, `description`) followed by markdown instructions.

#### Scenario: Skill directory contains valid SKILL.md

- **WHEN** a new skill is added at `plugins/taskless/skills/<name>/SKILL.md`
- **THEN** it SHALL contain YAML frontmatter with `name` (kebab-case, 1-64 chars) and `description` (up to 1024 chars)
- **AND** the markdown body SHALL contain instructions for the agent

### Requirement: Info skill confirms Taskless is working

The `/taskless:info` skill SHALL exist at `plugins/taskless/skills/info/SKILL.md`. When invoked, it SHALL detect the project's package manager by checking for lock files, invoke the CLI via `pnpm dlx @taskless/cli@latest info` or `npx @taskless/cli@latest info`, parse the JSON response, and report the CLI version. The skill SHALL confirm that Taskless is operational by displaying the version received from the CLI.

#### Scenario: Info skill detects pnpm and invokes CLI

- **WHEN** the info skill is invoked in a project with a `pnpm-lock.yaml` file
- **THEN** the agent SHALL run `pnpm dlx @taskless/cli@latest info`
- **AND** parse the JSON stdout to extract the `version` field
- **AND** report the version to the user

#### Scenario: Info skill falls back to npx

- **WHEN** the info skill is invoked in a project without a `pnpm-lock.yaml` file
- **THEN** the agent SHALL run `npx @taskless/cli@latest info`
- **AND** parse the JSON stdout to extract the `version` field
- **AND** report the version to the user

#### Scenario: Info skill handles CLI failure

- **WHEN** the CLI invocation fails (non-zero exit code or unparseable output)
- **THEN** the agent SHALL report that it could not reach the Taskless CLI and suggest troubleshooting steps
