# Skill: Rules Delete

## Purpose

Defines the `taskless-rules-delete` skill that conversationally identifies a rule and invokes the CLI to delete it.

## Requirements

### Requirement: Rules delete skill identifies rules conversationally

The `taskless-rules-delete` skill SHALL exist at `skills/taskless-rules-delete/SKILL.md`. When invoked, the agent SHALL help the user identify which rule to delete by listing available rules and confirming the target before executing the delete.

#### Scenario: Agent lists available rules

- **WHEN** the rules delete skill is invoked
- **THEN** the agent SHALL scan `.taskless/rules/` for `.yml` files
- **AND** present the available rule IDs to the user

#### Scenario: Agent confirms before deleting

- **WHEN** the user identifies a rule to delete
- **THEN** the agent SHALL confirm the rule ID with the user before running the delete command

#### Scenario: No rules found

- **WHEN** `.taskless/rules/` does not exist or contains no `.yml` files
- **THEN** the agent SHALL inform the user that no rules were found

### Requirement: Rules delete skill invokes CLI with rule ID

After confirming the target rule, the skill SHALL detect the package manager and invoke the CLI's `rules delete` command with the rule ID as a positional argument.

#### Scenario: Invocation with pnpm

- **WHEN** the skill is invoked in a project with `pnpm-lock.yaml`
- **THEN** the agent SHALL run `pnpm dlx @taskless/cli@latest rules delete <id>`

#### Scenario: Invocation with npm

- **WHEN** the skill is invoked in a project without `pnpm-lock.yaml`
- **THEN** the agent SHALL run `npx @taskless/cli@latest rules delete <id>`

#### Scenario: Successful deletion is reported

- **WHEN** the CLI completes deletion successfully
- **THEN** the agent SHALL confirm which rule and test files were removed

#### Scenario: Rule not found error is reported

- **WHEN** the CLI exits with an error indicating the rule was not found
- **THEN** the agent SHALL report the error and suggest checking the rule ID

### Requirement: Rules delete skill has correct frontmatter

The skill's YAML frontmatter SHALL include `name: taskless-rules-delete`, a description mentioning rule deletion, and `metadata` with `author: taskless` and `version` matching the CLI version.

#### Scenario: Frontmatter is valid

- **WHEN** inspecting `skills/taskless-rules-delete/SKILL.md`
- **THEN** the frontmatter SHALL have `name: taskless-rules-delete`
- **AND** `metadata.author` SHALL be `taskless`
- **AND** `metadata.version` SHALL match the CLI package version
