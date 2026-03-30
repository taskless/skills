# CLI Rules Improve

## Purpose

TBD — Defines the `rules improve` subcommand for the Taskless CLI, which iterates on existing rules via the `/cli/api/rule/{ruleId}/iterate` endpoint.

## Requirements

### Requirement: Rules improve reads request from file

The `taskless rules improve` command SHALL read a JSON request payload from a file specified by the `--from <file>` argument. The payload SHALL conform to the shape `{ ruleId: string, guidance: string, references?: Array<{ filename: string, content: string }> }`. The `ruleId` and `guidance` fields are required. If `--from` is not provided, the CLI SHALL print an error message with usage examples and exit with a non-zero exit code.

#### Scenario: Valid JSON from file

- **WHEN** a user runs `taskless rules improve --from request.json` and `request.json` contains valid JSON with `ruleId` and `guidance` fields
- **THEN** the CLI SHALL read the file, parse the JSON, and proceed to submit it to the API

#### Scenario: Missing --from flag

- **WHEN** a user runs `taskless rules improve` without the `--from` flag
- **THEN** the CLI SHALL print an error indicating `--from <file>` is required with a usage example
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Missing required ruleId field

- **WHEN** a user provides a file missing the `ruleId` field
- **THEN** the CLI SHALL print an error indicating the missing field
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Missing required guidance field

- **WHEN** a user provides a file missing the `guidance` field
- **THEN** the CLI SHALL print an error indicating the missing field
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Rules improve requires authentication

The `taskless rules improve` command SHALL require a valid auth token resolved via `getToken()`. If no token is available, the CLI SHALL print an error directing the user to run `taskless auth login` and exit with a non-zero exit code.

#### Scenario: No token available

- **WHEN** a user runs `taskless rules improve` with no token available
- **THEN** the CLI SHALL print an error indicating authentication is required
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Rules improve submits to iterate API and polls for results

The `taskless rules improve` command SHALL POST to `/cli/api/rule/{ruleId}/iterate` with `orgId` resolved from the JWT's `orgId` claim (via `resolveIdentity()`), `guidance`, and optional `references`. It SHALL receive a `requestId` in the response and poll `GET /cli/api/rule/{requestId}` at a 15-second interval until the status reaches `generated` or `failed`.

#### Scenario: Successful rule iteration

- **WHEN** the API accepts the iterate request and generation completes
- **THEN** the CLI SHALL receive a `requestId`, poll until status is `generated`, and proceed to write files

#### Scenario: Rule iteration fails

- **WHEN** the request status returns `failed` with an error message
- **THEN** the CLI SHALL print the error message
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Identity resolved from JWT and git remote

- **WHEN** the `rules improve` command resolves identity
- **THEN** it SHALL use `resolveIdentity()` to obtain `orgId` from the JWT claim
- **AND** it SHALL NOT read `orgId` from `taskless.json`

### Requirement: Rules improve writes updated files to disk

When iteration completes, the CLI SHALL write each rule to `.taskless/rules/{kebab-id}.yml` and test files to `.taskless/rule-tests/{kebab-id}-{timestamp}-test.yml`, overwriting existing files. This uses the same file-writing logic as `rules create`.

#### Scenario: Updated rule overwrites existing file

- **WHEN** the API returns an updated rule with id `no-console-log`
- **THEN** the CLI SHALL overwrite `.taskless/rules/no-console-log.yml` with the new content

### Requirement: Rules improve outputs results

After writing files, the CLI SHALL output a summary. In text mode, it SHALL list written file paths. In JSON mode (`--json`), it SHALL output a JSON object with `requestId`, `rules` array, and `files` array.

#### Scenario: JSON output

- **WHEN** `taskless rules improve` completes with `--json`
- **THEN** stdout SHALL contain a JSON object with `success`, `requestId`, `rules`, and `files` fields

### Requirement: Rules improve has a help entry

The `rules improve` subcommand SHALL have a help file at `packages/cli/src/help/rules-improve.txt` describing usage, options, and JSON file fields. The rules help index SHALL list `improve` alongside `create` and `delete`.

#### Scenario: Help is accessible

- **WHEN** a user runs `taskless help rules improve`
- **THEN** the CLI SHALL display the improve help text with usage, options, and JSON field descriptions
