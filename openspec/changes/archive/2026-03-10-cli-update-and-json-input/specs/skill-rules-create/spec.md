## MODIFIED Requirements

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

### Requirement: Rules create skill handles stale config errors

When the CLI reports a stale spec version error, the skill SHALL suggest running `taskless update-engine` instead of `taskless init`.

#### Scenario: Stale config error from CLI

- **WHEN** the CLI exits with an error about a stale spec version
- **THEN** the agent SHALL suggest running `taskless update-engine` to upgrade the project scaffold
- **AND** SHALL NOT suggest running `taskless init`
