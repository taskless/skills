# Skills Distribution

## Purpose

Defines the repo layout for skills and commands, the Claude Code Plugin Marketplace manifest, and the multi-channel distribution model.

## Requirements

### Requirement: Skills live in the standard discovery path

All Taskless skills SHALL be located at `skills/<name>/SKILL.md` in the repository root. The `skills/` directory is the standard discovery path recognized by the Vercel skills CLI and multiple agent tools. The `plugins/taskless/skills/` directory SHALL NOT be used.

#### Scenario: Skill exists at standard path

- **WHEN** a skill named `taskless-info` is added to the repository
- **THEN** it SHALL exist at `skills/taskless-info/SKILL.md`

#### Scenario: Skills are discoverable by Vercel skills CLI

- **WHEN** a user runs `npx skills add taskless/skills --list`
- **THEN** the CLI SHALL discover all skills under `skills/`

#### Scenario: Old plugins directory is not used

- **WHEN** inspecting the repository structure
- **THEN** the `plugins/` directory SHALL NOT exist

### Requirement: Skill names are globally qualified with taskless prefix

All Taskless skill directories and frontmatter `name` fields SHALL use the `taskless-` prefix (e.g., `taskless-info`, `taskless-auth-login`). The prefix is part of the source name, not applied at install time.

#### Scenario: Skill directory name matches frontmatter name

- **WHEN** a skill exists at `skills/taskless-info/SKILL.md`
- **THEN** the frontmatter `name` field SHALL be `taskless-info`

#### Scenario: All skills use the taskless prefix

- **WHEN** listing all skill directories under `skills/`
- **THEN** every directory name SHALL start with `taskless-`

### Requirement: Commands directory contains Claude Code command files

A `commands/taskless/` directory SHALL exist at the repository root containing command `.md` files for Claude Code. Each command file SHALL correspond to a skill with the `taskless-` prefix stripped from the filename.

#### Scenario: Command filename strips taskless prefix

- **WHEN** a skill exists at `skills/taskless-auth-login/SKILL.md`
- **THEN** a corresponding command SHALL exist at `commands/taskless/auth-login.md`

#### Scenario: Command frontmatter uses display name

- **WHEN** a command is generated for skill `taskless-auth-login`
- **THEN** the command frontmatter `name` SHALL be `"Taskless: Auth Login"`
- **AND** the `category` SHALL be `"Taskless"`
- **AND** the `tags` SHALL include `"taskless"`

#### Scenario: Command body matches skill body

- **WHEN** a command is generated from a skill
- **THEN** the command markdown body SHALL be identical to the skill's markdown body

### Requirement: Claude Code Plugin Marketplace manifest exists

A `.claude-plugin/marketplace.json` file SHALL exist at the repository root defining a marketplace with a single `taskless` plugin. The marketplace SHALL conform to the Claude Code marketplace schema.

#### Scenario: Marketplace lists one plugin

- **WHEN** inspecting `.claude-plugin/marketplace.json`
- **THEN** the `plugins` array SHALL contain exactly one entry with `name: "taskless"`
- **AND** the `source` SHALL be `"."`

#### Scenario: Marketplace has required fields

- **WHEN** inspecting `.claude-plugin/marketplace.json`
- **THEN** it SHALL have `name`, `owner` (with `name`), and `plugins` fields

### Requirement: Plugin manifest declares skills and commands

A `.claude-plugin/plugin.json` file SHALL exist declaring the `taskless` plugin with `skills` and `commands` paths pointing to the repo root directories.

#### Scenario: Plugin manifest declares component paths

- **WHEN** inspecting `.claude-plugin/plugin.json`
- **THEN** it SHALL declare `name: "taskless"`, a `description`, and a `version`
- **AND** it SHALL include `skills` pointing to `"./skills/"` or listing skill paths
- **AND** it SHALL include `commands` pointing to `"./commands/taskless/"` or listing command paths

### Requirement: Three distribution channels are supported

Skills SHALL be installable through three channels: `taskless init` (CLI), Claude Code Plugin Marketplace (`/plugin install`), and Vercel skills CLI (`npx skills add`). Each channel reads from the same source files in `skills/`.

#### Scenario: CLI route installs skills and commands

- **WHEN** a user runs `taskless init` in a project with `.claude/` directory
- **THEN** skills SHALL be placed in `.claude/skills/` and commands in `.claude/commands/taskless/`

#### Scenario: Marketplace route installs via plugin system

- **WHEN** a user runs `/plugin marketplace add taskless/skills` and `/plugin install taskless@taskless`
- **THEN** the plugin system SHALL install skills and commands from the repo

#### Scenario: Vercel CLI route discovers skills

- **WHEN** a user runs `npx skills add taskless/skills`
- **THEN** the skills CLI SHALL discover skills from the `skills/` directory
