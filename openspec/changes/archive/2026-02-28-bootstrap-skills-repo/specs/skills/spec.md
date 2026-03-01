## ADDED Requirements

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

The `/taskless:info` skill SHALL exist at `plugins/taskless/skills/info/SKILL.md`. When invoked, it SHALL output a confirmation message that Taskless is operational, including the skill version or repo context.

#### Scenario: Info skill is invoked

- **WHEN** a user runs `/taskless:info` in a Claude Code session with the plugin installed
- **THEN** the agent SHALL confirm that the Taskless skills plugin is installed and working

#### Scenario: Info skill provides version context

- **WHEN** the info skill runs
- **THEN** it SHALL reference the skills repository as the source
