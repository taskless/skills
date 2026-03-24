# Skill: Improve Rule

## Purpose

TBD — Defines the `taskless-improve-rule` skill that guides agents through improving existing Taskless rules by choosing between iterating, replacing, or expanding.

## Requirements

### Requirement: Skill inventories existing rules

The `taskless-improve-rule` skill SHALL scan `.taskless/rules/` for `.yml` files and present a summary of existing rules to the user if they have not indicated a specific rule to improve.

#### Scenario: Multiple rules exist

- **WHEN** the skill is invoked and `.taskless/rules/` contains multiple rule files
- **THEN** the skill SHALL list each rule's ID, language, and detected pattern

#### Scenario: No rules exist

- **WHEN** the skill is invoked and `.taskless/rules/` is empty
- **THEN** the skill SHALL inform the user there are no rules to improve

### Requirement: Skill determines improvement approach

The skill SHALL evaluate the user's feedback and choose one of three approaches: (A) iterate on the existing rule via the improve CLI command, (B) replace the rule by creating a new one and deleting the old, or (C) expand by creating additional rules. The skill SHALL present the chosen approach to the user for confirmation before proceeding.

#### Scenario: Iterate approach selected

- **WHEN** the user wants to refine an existing rule (e.g., fix false positives)
- **THEN** the skill SHALL choose Option A and use the `rules improve` CLI command

#### Scenario: Replace approach selected

- **WHEN** the rule is fundamentally wrong and needs a different approach
- **THEN** the skill SHALL choose Option B and use `taskless-create-rule` followed by `rules delete`

#### Scenario: Expand approach selected

- **WHEN** the user's need has expanded beyond a single rule
- **THEN** the skill SHALL choose Option C and create additional rules via `taskless-create-rule`

### Requirement: Skill builds iterate payload with references

When using the iterate approach, the skill SHALL build a JSON payload containing `ruleId`, `guidance`, and optionally `references` (current rule and test file contents). The skill SHALL write this to `.taskless/.tmp-improve-request.json`, invoke the CLI, and clean up the temp file.

#### Scenario: Payload includes references

- **WHEN** the skill iterates on a rule that has associated test files
- **THEN** the payload SHALL include both the rule file and test file as references

### Requirement: Skill cross-references use skill names

The skill SHALL reference other skills by their skill name (e.g., `taskless-create-rule`, `taskless-check`, `taskless-login`) rather than command names, for compatibility with non-command agentic systems.

#### Scenario: Suggesting follow-up actions

- **WHEN** the skill suggests testing after improvement
- **THEN** the skill SHALL reference `taskless-check` not `tskl:check`
