# Skill: Rules Create

## Purpose

Defines the `taskless-rules-create` skill that conversationally gathers rule details and invokes the CLI to create rules.

## Requirements

### Requirement: Rules create skill gathers input conversationally

The `taskless-rules-create` skill SHALL exist at `skills/taskless-rules-create/SKILL.md`. When invoked, the agent SHALL gather the required information from the user through conversation, construct a JSON payload, and pipe it to the CLI's `rules create` command.

#### Scenario: Agent gathers minimal input

- **WHEN** the rules create skill is invoked and the user provides a prompt like "detect console.log usage"
- **THEN** the agent SHALL construct a JSON payload with `{ "prompt": "detect console.log usage" }`
- **AND** pipe it to the CLI via stdin

#### Scenario: Agent asks for clarification when needed

- **WHEN** the user's request is ambiguous (e.g., "create a rule")
- **THEN** the agent SHALL ask clarifying questions about what the rule should detect

#### Scenario: Agent may analyze codebase for context

- **WHEN** the user's request could benefit from codebase context (e.g., language, patterns)
- **THEN** the agent MAY analyze the codebase to populate the `language`, `successCase`, and `failureCase` fields
- **AND** the agent SHALL confirm its assumptions with the user before proceeding

### Requirement: Rules create skill invokes CLI with JSON stdin

The skill SHALL write the constructed JSON payload to a temporary file and invoke the CLI using the `--from` flag. The skill SHALL clean up the temporary file after the CLI completes, regardless of success or failure.

#### Scenario: Invocation with pnpm

- **WHEN** the skill is invoked in a project with `pnpm-lock.yaml`
- **THEN** the agent SHALL write the JSON payload to `.taskless/.tmp-rule-request.json`
- **AND** run `pnpm dlx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`
- **AND** delete `.taskless/.tmp-rule-request.json` after the command completes

#### Scenario: Invocation with npm

- **WHEN** the skill is invoked in a project without `pnpm-lock.yaml`
- **THEN** the agent SHALL write the JSON payload to `.taskless/.tmp-rule-request.json`
- **AND** run `npx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`
- **AND** delete `.taskless/.tmp-rule-request.json` after the command completes

#### Scenario: CLI output is reported to user

- **WHEN** the CLI completes rule generation
- **THEN** the agent SHALL report the generated file paths to the user

#### Scenario: CLI error is reported to user

- **WHEN** the CLI exits with a non-zero exit code
- **THEN** the agent SHALL report the error message to the user
- **AND** suggest corrective actions (e.g., run `taskless auth login`, run `taskless update-engine`)

### Requirement: Rules create skill constructs valid JSON payload

The JSON payload piped to stdin SHALL conform to `{ prompt: string, language?: string, successCase?: string, failureCase?: string }`. The `prompt` field is required. Optional fields SHALL only be included if the agent has gathered them from the user or inferred them from context.

#### Scenario: Minimal payload

- **WHEN** only a prompt is provided
- **THEN** the JSON payload SHALL be `{ "prompt": "<user prompt>" }`

#### Scenario: Full payload with all fields

- **WHEN** the agent has gathered prompt, language, success case, and failure case
- **THEN** the JSON payload SHALL include all four fields

### Requirement: Rules create skill handles stale config errors

When the CLI reports a stale spec version error, the skill SHALL suggest running `taskless update-engine` instead of `taskless init`.

#### Scenario: Stale config error from CLI

- **WHEN** the CLI exits with an error about a stale spec version
- **THEN** the agent SHALL suggest running `taskless update-engine` to upgrade the project scaffold
- **AND** SHALL NOT suggest running `taskless init`

### Requirement: Rules create skill has correct frontmatter

The skill's YAML frontmatter SHALL include `name: taskless-rules-create`, a description mentioning rule creation, and `metadata` with `author: taskless` and `version` matching the CLI version.

#### Scenario: Frontmatter is valid

- **WHEN** inspecting `skills/taskless-rules-create/SKILL.md`
- **THEN** the frontmatter SHALL have `name: taskless-rules-create`
- **AND** `metadata.author` SHALL be `taskless`
- **AND** `metadata.version` SHALL match the CLI package version
