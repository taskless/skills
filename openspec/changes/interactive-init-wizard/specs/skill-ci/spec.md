## ADDED Requirements

### Requirement: Taskless CI skill is bundled in the CLI

The CLI build SHALL embed a `taskless-ci` skill file at `skills/taskless-ci/SKILL.md` into the compiled bundle using the same `import.meta.glob` pattern as all other skills. The skill SHALL NOT register a slash command — its frontmatter SHALL NOT contain a `commandName` field, and no companion file in `commands/tskl/` SHALL be installed for it.

#### Scenario: Build includes taskless-ci skill

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** the `skills/taskless-ci/SKILL.md` file SHALL be embedded in the output bundle

#### Scenario: Skill name matches convention

- **WHEN** the `taskless-ci` skill is installed
- **THEN** the `name` field in its SKILL.md frontmatter SHALL be `taskless-ci`

### Requirement: Taskless CI skill is marked optional in the skill catalog

The CLI SHALL classify each bundled skill as either `mandatory` or `optional` via an exported catalog. The `taskless-ci` skill SHALL be classified as `optional`. All other skills currently in the bundle SHALL be classified as `mandatory`. The init wizard and `--no-interactive` code paths SHALL use this classification to decide whether a skill is installed automatically or requires explicit opt-in.

#### Scenario: CI skill is optional

- **WHEN** the skill catalog is loaded
- **THEN** the `taskless-ci` entry SHALL have `optional: true`

#### Scenario: Existing skills are mandatory

- **WHEN** the skill catalog is loaded
- **THEN** every bundled skill other than `taskless-ci` SHALL have `optional: false`

#### Scenario: Non-interactive install skips optional skills

- **WHEN** a user runs `taskless init --no-interactive`
- **THEN** the CLI SHALL install every skill classified as `mandatory`
- **AND** the CLI SHALL NOT install any skill classified as `optional`

#### Scenario: Wizard offers optional skills as opt-in

- **WHEN** the init wizard renders its optional-skills step
- **THEN** every skill classified as `optional` SHALL appear in the multi-select
- **AND** every optional skill SHALL be unchecked by default

### Requirement: Taskless CI skill teaches full-scan and diff-scan patterns

The `taskless-ci` SKILL.md SHALL instruct invoking agents on two reusable CI patterns that work with any CI system:

- **Full scan**: `taskless check` without path arguments, for runs on the main/default branch.
- **Diff scan**: `taskless check <paths>` where `<paths>` is the output of `git diff --name-only <base>...HEAD`, for pull-request runs.

The skill body SHALL:

1. Explain how to compute the diff target for common CI systems (GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure Pipelines, Bitbucket Pipelines) AND instruct agents to apply the same pattern to CI systems not explicitly listed.
2. Recommend a default of "diff scan on PRs, full scan on pushes to main" but allow the user to override.
3. Document that `taskless check` silently filters non-existent paths, so raw `git diff --name-only` output can be piped in directly without pre-filtering deleted files.

#### Scenario: Skill teaches both scan patterns

- **WHEN** an agent invokes the `taskless-ci` skill
- **THEN** the skill body SHALL describe both the full-scan invocation (`taskless check`) and the diff-scan invocation (`taskless check <paths>`)

#### Scenario: Skill provides CI system hints without restricting to a fixed list

- **WHEN** an agent reads the skill body
- **THEN** the skill SHALL list common CI systems with their detection signals as hints
- **AND** the skill SHALL direct the agent to apply the same patterns to unlisted CI systems that the agent recognizes

#### Scenario: Skill recommends a default scan pattern

- **WHEN** the agent asks the user how they want CI to run
- **THEN** the skill SHALL recommend diff-scan on pull requests and full-scan on main-branch pushes as the default
- **AND** the skill SHALL allow the user to override (e.g., full-scan everywhere, or diff-scan only)

### Requirement: Taskless CI skill generates non-destructive configuration

The `taskless-ci` skill SHALL instruct invoking agents to generate configuration without modifying files the user already owns. The skill body SHALL:

1. Require the agent to write a new, standalone file rather than editing an existing CI config.
2. For CI systems with native include/import support, write a standalone snippet and tell the user the single line to add to their main config.
3. For CI systems without include support, write a standalone snippet to a canonical `.taskless/ci/` path and provide explicit instructions for where to paste it.
4. Before overwriting any target file that already exists, require the agent to ask the user for confirmation.

#### Scenario: Skill instructs agent to write standalone files

- **WHEN** an agent invokes the skill to set up CI
- **THEN** the skill body SHALL direct the agent to write a new standalone file rather than modifying an existing CI config

#### Scenario: Skill requires confirmation before overwriting

- **WHEN** the target CI config path already exists
- **THEN** the skill body SHALL direct the agent to prompt the user before overwriting

### Requirement: Taskless CI skill requires no authentication

The `taskless-ci` skill SHALL state that `taskless check` does not require authentication and that the generated CI configuration therefore needs no secrets or environment variables. The skill body SHALL only mention authentication if the user explicitly asks about running authenticated commands (e.g., `rules create`) in CI.

#### Scenario: Skill documents no-auth requirement

- **WHEN** an agent reads the skill body
- **THEN** the skill SHALL state that `taskless check` requires no authentication
- **AND** the skill SHALL state that the generated CI config needs no secrets

### Requirement: Taskless CI skill gates CI setup on rule presence

The `taskless-ci` skill SHALL direct the agent to verify `taskless check` runs successfully locally before writing any CI configuration. If `taskless check` reports that no rules are configured, the agent SHALL stop and invoke the `taskless-create-rule` skill (or ask the user to create rules) instead of writing a CI config that would produce an always-green check with no coverage.

#### Scenario: Skill refuses to write CI with no rules

- **WHEN** `taskless check` reports "No rules configured" during the local verification step
- **THEN** the skill SHALL direct the agent NOT to write any CI configuration
- **AND** the skill SHALL direct the agent to invoke `taskless-create-rule` or ask the user to create rules first
