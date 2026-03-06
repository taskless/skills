# Skills

## MODIFIED Requirements

### Requirement: Skills use SKILL.md format with YAML frontmatter

Each skill SHALL be defined in its own directory under `skills/<name>/` with a `SKILL.md` file containing YAML frontmatter (`name`, `description`, `metadata`) followed by markdown instructions. The `name` field SHALL use the `taskless-` prefix (e.g., `taskless-info`). The `metadata` field SHALL include `author` and `version` keys. The `version` key SHALL be used for staleness detection when skills are installed into target repositories.

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

### Requirement: Info skill confirms Taskless is working

The `taskless-info` skill SHALL exist at `skills/taskless-info/SKILL.md`. When invoked, it SHALL detect the project's package manager by checking for lock files, invoke the CLI via `pnpm dlx @taskless/cli@latest info` or `npx @taskless/cli@latest info`, parse the JSON response, and report the CLI version. The skill SHALL confirm that Taskless is operational by displaying the version received from the CLI.

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
