## ADDED Requirements

### Requirement: Taskless CI skill is bundled in the CLI

The CLI build SHALL embed a `taskless-ci` skill file at `skills/taskless-ci/SKILL.md` into the compiled bundle using the same `import.meta.glob` pattern as all other skills. The skill's runtime behavior (CI environment detection, workflow generation) is defined in a separate change; this capability only requires that the skill is present in the bundle and is selectable via the init wizard.

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
