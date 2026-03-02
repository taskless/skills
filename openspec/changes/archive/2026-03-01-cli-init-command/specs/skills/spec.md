## REMOVED Requirements

### Requirement: Claude Code plugin marketplace structure

**Reason**: Replaced by CLI-driven installation via `taskless init`. The plugin marketplace approach only worked for Claude Code and required a specific directory structure. CLI install is tool-agnostic and consistent.

**Migration**: Run `taskless init` to install skills. Remove `.claude-plugin/marketplace.json` and `plugins/taskless/.claude-plugin/plugin.json`.

## MODIFIED Requirements

### Requirement: Skills use SKILL.md format with YAML frontmatter

Each skill SHALL be defined in its own directory under `plugins/taskless/skills/<name>/` with a `SKILL.md` file containing YAML frontmatter (`name`, `description`, `metadata`) followed by markdown instructions. The `name` field SHALL use bare names (without a namespace prefix). The `metadata` field SHALL include `author` and `version` keys. The `version` key SHALL be used for staleness detection when skills are installed into target repositories.

#### Scenario: Skill directory contains valid SKILL.md

- **WHEN** a new skill is added at `plugins/taskless/skills/<name>/SKILL.md`
- **THEN** it SHALL contain YAML frontmatter with `name` (kebab-case, 1-64 chars) and `description` (up to 1024 chars)
- **AND** the `metadata` field SHALL include `author: taskless` and `version` (string matching CLI package version)
- **AND** the markdown body SHALL contain instructions for the agent

#### Scenario: Skill name matches directory name

- **WHEN** a skill exists at `plugins/taskless/skills/info/SKILL.md`
- **THEN** the `name` field in frontmatter SHALL be `info` (bare, without namespace prefix)

#### Scenario: Skills are bundled into CLI at build time

- **WHEN** the CLI is built
- **THEN** all SKILL.md files under `plugins/taskless/skills/` SHALL be embedded into the CLI bundle
- **AND** the skill content SHALL be available at runtime without filesystem or network access
