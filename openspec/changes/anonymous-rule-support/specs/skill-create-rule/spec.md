## RENAMED Requirements

### Requirement: Capability renamed

FROM: `skill-rules-create`
TO: `skill-create-rule`

## ADDED Requirements

### Requirement: Rules create skill routes by authentication status

The `taskless-create-rule` skill SHALL check authentication status before proceeding with rule creation. If the user is authenticated, the skill SHALL proceed with the existing API-backed flow. If the user is not authenticated, the skill SHALL delegate to the `taskless-create-rule-anonymous` skill.

#### Scenario: Authenticated user gets API flow

- **WHEN** the rules create skill is invoked
- **AND** `taskless info --json` returns `"loggedIn": true`
- **THEN** the skill SHALL proceed with the existing behavior: gather input, construct JSON payload, and invoke `taskless rules create --from <file> --json`

#### Scenario: Unauthenticated user gets anonymous flow

- **WHEN** the rules create skill is invoked
- **AND** `taskless info --json` returns `"loggedIn": false`
- **THEN** the skill SHALL delegate to the `taskless-create-rule-anonymous` skill

#### Scenario: Auth check happens before input gathering

- **WHEN** the rules create skill is invoked
- **THEN** the auth check via `taskless info --json` SHALL happen before gathering any rule input from the user

### Requirement: Anonymous create skill derives rules locally via agent

The `taskless-create-rule-anonymous` skill SHALL exist at `skills/taskless-create-rule-anonymous/SKILL.md`. When invoked, the agent SHALL use the ast-grep schema from `taskless rules verify --schema --json` to understand rule syntax, derive a rule from the user's description, and validate it using the verify feedback loop. This skill SHALL NOT make any API calls or require authentication.

#### Scenario: Agent learns ast-grep syntax from schema

- **WHEN** the anonymous create skill is invoked
- **THEN** the agent SHALL run `taskless rules verify --schema --json`
- **AND** use the `astGrepSchema`, `tasklessRequirements`, and `examples` from the output to understand how to write valid ast-grep rules

#### Scenario: Agent gathers input conversationally

- **WHEN** the user provides a description of the rule to create
- **THEN** the agent SHALL gather sufficient context (language, patterns to detect, examples of good/bad code)
- **AND** derive an ast-grep rule YAML based on the schema and examples

### Requirement: Anonymous create skill writes rule and test files

The agent SHALL write the derived rule to `.taskless/rules/<id>.yml` and test cases to `.taskless/rule-tests/<id>-<YYYYMMDD>-test.yml` following the same naming conventions as API-generated rules.

#### Scenario: Rule file is written

- **WHEN** the agent has derived a rule
- **THEN** it SHALL write the rule YAML to `.taskless/rules/<id>.yml`
- **AND** the rule SHALL include all Taskless-required fields: `id`, `language`, `severity`, `message`, and `rule`

#### Scenario: Test file is written

- **WHEN** the agent has derived a rule
- **THEN** it SHALL also write a test file to `.taskless/rule-tests/<id>-<YYYYMMDD>-test.yml`
- **AND** the test file SHALL contain `id`, `valid` (code that should NOT trigger), and `invalid` (code that SHOULD trigger) fields

### Requirement: Anonymous create skill uses verify feedback loop

After writing the rule and test files, the agent SHALL run `taskless rules verify <id> --json` and fix any reported errors. The agent SHALL repeat the verify-fix cycle until verification passes or a reasonable attempt limit is reached.

#### Scenario: Verify passes on first attempt

- **WHEN** the agent writes a rule and runs `taskless rules verify <id> --json`
- **AND** the result has `"success": true`
- **THEN** the agent SHALL report success to the user with the created file paths

#### Scenario: Verify fails and agent fixes errors

- **WHEN** `taskless rules verify <id> --json` returns `"success": false`
- **THEN** the agent SHALL read the error details from each validation layer
- **AND** fix the rule and/or test files accordingly
- **AND** re-run `taskless rules verify <id> --json`

#### Scenario: Verify loop gives up after reasonable attempts

- **WHEN** the agent has attempted to fix errors multiple times without achieving a passing verify
- **THEN** the agent SHALL inform the user of the remaining issues and suggest manual review

### Requirement: Anonymous create skill produces no metadata sidecar

Rules created by the anonymous skill SHALL NOT create files in `.taskless/rule-metadata/`. There is no ticket ID or installation ID to record for locally-derived rules.

#### Scenario: No metadata files created

- **WHEN** the anonymous skill completes rule creation
- **THEN** no files SHALL be written to `.taskless/rule-metadata/`

### Requirement: Anonymous create skill is not directly invocable

The `taskless-create-rule-anonymous` skill SHALL NOT have a corresponding `/tskl:` command. It SHALL only be invoked by the `taskless-create-rule` router skill when the user is not authenticated.

#### Scenario: No command file exists

- **WHEN** the skills are installed
- **THEN** there SHALL be no command file in `commands/tskl/` for the anonymous create skill

### Requirement: Anonymous create skill has correct frontmatter

The skill's YAML frontmatter SHALL include `name: taskless-create-rule-anonymous`, a description mentioning anonymous/local rule creation, and `metadata` with `author: taskless` and `version` matching the CLI version.

#### Scenario: Frontmatter is valid

- **WHEN** inspecting `skills/taskless-create-rule-anonymous/SKILL.md`
- **THEN** the frontmatter SHALL have `name: taskless-create-rule-anonymous`
- **AND** `metadata.author` SHALL be `taskless`
- **AND** `metadata.version` SHALL match the CLI package version
