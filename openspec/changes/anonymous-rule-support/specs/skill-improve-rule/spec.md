## ADDED Requirements

### Requirement: Improve rule skill routes by authentication status

The `taskless-improve-rule` skill SHALL check authentication status before proceeding with rule improvement. If the user is authenticated, the skill SHALL proceed with the existing API-backed flow. If the user is not authenticated, the skill SHALL delegate to the `taskless-improve-rule-anonymous` skill.

#### Scenario: Authenticated user gets API flow

- **WHEN** the improve rule skill is invoked
- **AND** `taskless info --json` returns `"loggedIn": true`
- **THEN** the skill SHALL proceed with the existing behavior: inventory rules, determine approach, and invoke the CLI

#### Scenario: Unauthenticated user gets anonymous flow

- **WHEN** the improve rule skill is invoked
- **AND** `taskless info --json` returns `"loggedIn": false`
- **THEN** the skill SHALL delegate to the `taskless-improve-rule-anonymous` skill

#### Scenario: Auth check happens before rule inventory

- **WHEN** the improve rule skill is invoked
- **THEN** the auth check via `taskless info --json` SHALL happen before inventorying rules or gathering improvement guidance

### Requirement: Anonymous improve skill iterates on rules locally via agent

The `taskless-improve-rule-anonymous` skill SHALL exist at `skills/taskless-improve-rule-anonymous/SKILL.md`. When invoked, the agent SHALL read the existing rule and test files, understand the user's improvement guidance, modify the rule locally, and validate changes using the verify feedback loop. This skill SHALL NOT make any API calls or require authentication.

#### Scenario: Agent reads existing rule and tests

- **WHEN** the anonymous improve skill is invoked for rule `<id>`
- **THEN** the agent SHALL read `.taskless/rules/<id>.yml` and any matching test file in `.taskless/rule-tests/`
- **AND** run `taskless rules verify --schema --json` to understand ast-grep rule syntax

#### Scenario: Agent gathers improvement guidance

- **WHEN** the user describes what to improve (e.g., "reduce false positives on arrow functions")
- **THEN** the agent SHALL analyze the existing rule against the guidance
- **AND** modify the rule YAML accordingly

### Requirement: Anonymous improve skill writes updated files

The agent SHALL overwrite the existing rule file at `.taskless/rules/<id>.yml` and write a new test file at `.taskless/rule-tests/<id>-<YYYYMMDD>-test.yml` reflecting the improved rule.

#### Scenario: Rule file is updated in place

- **WHEN** the agent improves a rule
- **THEN** it SHALL overwrite `.taskless/rules/<id>.yml` with the updated rule YAML

#### Scenario: New test file is created

- **WHEN** the agent improves a rule
- **THEN** it SHALL write a new test file to `.taskless/rule-tests/<id>-<YYYYMMDD>-test.yml`
- **AND** the test file SHALL include cases that exercise the improved behavior

### Requirement: Anonymous improve skill uses verify feedback loop

After writing the updated files, the agent SHALL run `taskless rules verify <id> --json` and fix any reported errors, repeating until verification passes.

#### Scenario: Verify passes after improvement

- **WHEN** the agent updates a rule and runs `taskless rules verify <id> --json`
- **AND** the result has `"success": true`
- **THEN** the agent SHALL report success to the user

#### Scenario: Verify fails and agent fixes errors

- **WHEN** `taskless rules verify <id> --json` returns `"success": false`
- **THEN** the agent SHALL fix the issues and re-verify

### Requirement: Anonymous improve skill supports all improvement approaches

The anonymous improve skill SHALL support the same three approaches as the authenticated improve skill: (A) iterate on the existing rule, (B) replace the rule by creating a new one and deleting the old, or (C) expand by creating additional rules. For approaches B and C, the skill SHALL delegate to `taskless-create-rule-anonymous` for new rule creation.

#### Scenario: Iterate approach

- **WHEN** the user wants to refine an existing rule
- **THEN** the skill SHALL modify the rule in place and verify

#### Scenario: Replace approach

- **WHEN** the rule needs a fundamentally different approach
- **THEN** the skill SHALL invoke `taskless-create-rule-anonymous` for the new rule
- **AND** delete the old rule via `taskless rules delete <old-id>`

#### Scenario: Expand approach

- **WHEN** the user's need requires additional rules
- **THEN** the skill SHALL invoke `taskless-create-rule-anonymous` for each new rule

### Requirement: Anonymous improve skill is not directly invocable

The `taskless-improve-rule-anonymous` skill SHALL NOT have a corresponding `/tskl:` command. It SHALL only be invoked by the `taskless-improve-rule` router skill when the user is not authenticated.

#### Scenario: No command file exists

- **WHEN** the skills are installed
- **THEN** there SHALL be no command file in `commands/tskl/` for the anonymous improve skill

### Requirement: Anonymous improve skill has correct frontmatter

The skill's YAML frontmatter SHALL include `name: taskless-improve-rule-anonymous`, a description mentioning anonymous/local rule improvement, and `metadata` with `author: taskless` and `version` matching the CLI version.

#### Scenario: Frontmatter is valid

- **WHEN** inspecting `skills/taskless-improve-rule-anonymous/SKILL.md`
- **THEN** the frontmatter SHALL have `name: taskless-improve-rule-anonymous`
- **AND** `metadata.author` SHALL be `taskless`
- **AND** `metadata.version` SHALL match the CLI package version
