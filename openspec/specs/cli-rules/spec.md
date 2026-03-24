# CLI Rules

## Purpose

TBD — Defines the `rules` subcommand group for the Taskless CLI, including `create`, `improve`, and `delete` subcommands for managing ast-grep rules via the Taskless API.

## Requirements

### Requirement: Rules subcommand group exists

The CLI SHALL register a `rules` subcommand group with `create`, `improve`, and `delete` as nested subcommands. Running `taskless rules` with no subcommand SHALL display help text listing the available rules subcommands.

#### Scenario: Rules help is displayed

- **WHEN** a user runs `taskless rules`
- **THEN** the CLI SHALL print help text listing `create`, `improve`, and `delete` subcommands

### Requirement: Rules create reads request from stdin

The `taskless rules create` command SHALL read a JSON request payload from a file specified by the `--from <file>` argument. The payload SHALL conform to the shape `{ prompt: string, successCases?: string[], failureCases?: string[] }`. The `prompt` field is required. If `--from` is not provided, the CLI SHALL print an error message with usage examples and exit with a non-zero exit code. If the file does not exist or contains invalid JSON, the CLI SHALL print an appropriate error and exit with a non-zero exit code.

#### Scenario: Valid JSON from file

- **WHEN** a user runs `taskless rules create --from request.json` and `request.json` contains valid JSON with a `prompt` field
- **THEN** the CLI SHALL read the file, parse the JSON, and proceed to submit it to the API

#### Scenario: Missing --from flag

- **WHEN** a user runs `taskless rules create` without the `--from` flag
- **THEN** the CLI SHALL print an error indicating `--from <file>` is required with a usage example
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: File not found

- **WHEN** a user runs `taskless rules create --from missing.json` and the file does not exist
- **THEN** the CLI SHALL print an error indicating the file was not found
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Invalid JSON in file

- **WHEN** a user runs `taskless rules create --from bad.json` and the file contains invalid JSON
- **THEN** the CLI SHALL print an error indicating the file is not valid JSON
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Missing required fields

- **WHEN** a user provides a file missing the `prompt` field
- **THEN** the CLI SHALL print an error indicating the missing field
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Rules create resolves orgId and repositoryUrl from project config

The `taskless rules create` command SHALL read `orgId` (number) and `repositoryUrl` (string) from `.taskless/taskless.json`. These fields are required by the API and SHALL NOT be provided via stdin. If either field is missing from `taskless.json`, the CLI SHALL print an error and exit with a non-zero exit code.

#### Scenario: Both fields present in taskless.json

- **WHEN** `.taskless/taskless.json` contains `orgId` and `repositoryUrl`
- **THEN** the CLI SHALL use these values in the API request

#### Scenario: orgId missing from taskless.json

- **WHEN** `.taskless/taskless.json` does not contain `orgId`
- **THEN** the CLI SHALL print an error indicating `orgId` is required in `taskless.json`
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: repositoryUrl missing from taskless.json

- **WHEN** `.taskless/taskless.json` does not contain `repositoryUrl`
- **THEN** the CLI SHALL print an error indicating `repositoryUrl` is required in `taskless.json`
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Rules create requires a minimum scaffold version

The `taskless rules create` command SHALL validate the scaffold version from `.taskless/taskless.json` against its entry in `MIN_SCAFFOLD_VERSION`. If below the minimum, the CLI SHALL fast-fail with a message showing the current version, required version, and directing the user to run `taskless update-engine`.

#### Scenario: Scaffold version too old

- **WHEN** `.taskless/taskless.json` has a version below the `'rules create'` entry in `MIN_SCAFFOLD_VERSION`
- **THEN** the CLI SHALL print: "Scaffold version <current> is below the minimum <required> required for 'taskless rules create'. Run 'taskless update-engine' to update."
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Scaffold version is sufficient

- **WHEN** `.taskless/taskless.json` has a version at or above the `'rules create'` minimum
- **THEN** the CLI SHALL proceed normally

### Requirement: Rules create requires authentication

The `taskless rules create` command SHALL require a valid auth token. The token SHALL be resolved using the existing `getToken()` utility (env var first, then file). If no token is available, the CLI SHALL print an error directing the user to run `taskless auth login` and exit with a non-zero exit code.

#### Scenario: No token available

- **WHEN** a user runs `taskless rules create` with no `TASKLESS_TOKEN` env var and no token file
- **THEN** the CLI SHALL print an error indicating authentication is required
- **AND** the CLI SHALL suggest running `taskless auth login`
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Token from env var

- **WHEN** `TASKLESS_TOKEN` is set
- **THEN** the CLI SHALL use it as the bearer token for API requests

#### Scenario: Token from file

- **WHEN** `TASKLESS_TOKEN` is not set and a token file exists
- **THEN** the CLI SHALL use the file-based token for API requests

### Requirement: Rules create submits to API and polls for results

The `taskless rules create` command SHALL POST to `POST /cli/api/request` with `orgId`, `repositoryUrl`, `prompt`, and optional `language`, `successCase`, `failureCase`. It SHALL receive a `requestId` in the response and poll `GET /cli/api/request/:requestId` at a 15-second interval until the status reaches `generated` or `failed`.

#### Scenario: Successful rule generation

- **WHEN** the API accepts the request and rule generation completes
- **THEN** the CLI SHALL receive a `requestId`, poll until status is `generated`, and proceed to write files

#### Scenario: Rule generation fails

- **WHEN** the request status returns `failed` with an error message
- **THEN** the CLI SHALL print the error message
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: API returns validation error

- **WHEN** the API returns HTTP 400 with `error: "validation_error"` and a `details` array
- **THEN** the CLI SHALL print the validation details
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Repository not accessible

- **WHEN** the API returns HTTP 403 with `error: "repository_not_accessible"`
- **THEN** the CLI SHALL print an error indicating the repository is not accessible to the organization
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Organization not found

- **WHEN** the API returns HTTP 404 with `error: "organization_not_found"`
- **THEN** the CLI SHALL print an error indicating the organization was not found
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Polling shows progressive status

- **WHEN** the CLI is polling and the status transitions from `accepted` to `building`
- **THEN** the CLI SHALL update the progress message to reflect the current status

#### Scenario: API not yet available (stub)

- **WHEN** the network layer is stubbed (API not yet implemented)
- **THEN** the CLI SHALL print a clear message indicating that rule generation is not yet available
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Rules create uses a network interface with stub

The API calls for rule generation (`POST /cli/api/request` and `GET /cli/api/request/:requestId`) SHALL be defined as a TypeScript interface. The initial implementation SHALL use a stub that returns an error indicating the API is not yet available. This allows the CLI UX to be built and tested independently of the API.

#### Scenario: Stub implementation returns an error

- **WHEN** `rules create` is run against the stub network layer
- **THEN** the stub SHALL return an error indicating rule generation is not yet available

#### Scenario: Interface is swappable

- **WHEN** the real API becomes available
- **THEN** the stub SHALL be replaceable with a real HTTP implementation without changing the command logic

### Requirement: Rules create writes rule files to disk

When rule generation completes, the CLI SHALL write each generated rule to `.taskless/rules/{kebab-id}.yml`. The file content SHALL be the `content` field of the generated rule serialized as YAML. If a file with the same name already exists, it SHALL be overwritten.

#### Scenario: Single rule generated

- **WHEN** the API returns one rule with id `no-console-log`
- **THEN** the CLI SHALL write `.taskless/rules/no-console-log.yml` containing the rule serialized as YAML

#### Scenario: Multiple rules generated

- **WHEN** the API returns two rules with ids `no-console-log` and `no-inner-html`
- **THEN** the CLI SHALL write `.taskless/rules/no-console-log.yml` and `.taskless/rules/no-inner-html.yml`

#### Scenario: Existing rule file is overwritten

- **WHEN** `.taskless/rules/no-console-log.yml` already exists and the API returns a rule with id `no-console-log`
- **THEN** the CLI SHALL overwrite the existing file with the new content

### Requirement: Rules create writes test files to disk

When rule generation completes and a rule includes test cases, the CLI SHALL write test files to `.taskless/rule-tests/{kebab-id}-{timestamp}-test.yml`. The timestamp SHALL be the current date formatted as `YYYYMMDD`. The test file SHALL contain the rule id, valid snippets, and invalid snippets serialized as YAML.

#### Scenario: Rule with test cases

- **WHEN** the API returns a rule with id `no-console-log` that includes test cases
- **THEN** the CLI SHALL write `.taskless/rule-tests/no-console-log-20260302-test.yml`
- **AND** the file SHALL contain `id`, `valid`, and `invalid` fields

#### Scenario: Rule without test cases

- **WHEN** the API returns a rule with no `tests` field
- **THEN** the CLI SHALL NOT write a test file for that rule

#### Scenario: Rules directory is created if missing

- **WHEN** `.taskless/rules/` or `.taskless/rule-tests/` does not exist
- **THEN** the CLI SHALL create the directory before writing files

### Requirement: Rules create outputs results

After writing files, the CLI SHALL output a summary to stdout. In text mode, the summary SHALL include a list of files written. In JSON mode (`--json`), the full generation result SHALL be output along with the file paths written.

#### Scenario: Text output

- **WHEN** `taskless rules create` completes without `--json`
- **THEN** stdout SHALL include a list of written file paths

#### Scenario: JSON output

- **WHEN** `taskless rules create` completes with `--json`
- **THEN** stdout SHALL contain a JSON object with the full result and an array of written file paths

### Requirement: Rules create shows progress during polling

While polling for the request result, the CLI SHALL display a waiting message to stderr so the user knows the command is active. The message SHALL reflect the current status (`accepted`, `building`).

#### Scenario: Polling shows progress

- **WHEN** the CLI is polling for a request result
- **THEN** the CLI SHALL print a waiting/progress message to stderr indicating the current status

### Requirement: Rules delete removes rule and test files

The `taskless rules delete <id>` command SHALL remove `.taskless/rules/{id}.yml` and any matching files in `.taskless/rule-tests/` that begin with `{id}-`. If the rule file does not exist, the CLI SHALL print an error and exit with a non-zero exit code.

#### Scenario: Successful deletion

- **WHEN** a user runs `taskless rules delete no-console-log` and `.taskless/rules/no-console-log.yml` exists
- **THEN** the CLI SHALL delete `.taskless/rules/no-console-log.yml`
- **AND** the CLI SHALL delete any files matching `.taskless/rule-tests/no-console-log-*-test.yml`
- **AND** the CLI SHALL print a confirmation message

#### Scenario: Rule not found

- **WHEN** a user runs `taskless rules delete no-console-log` and `.taskless/rules/no-console-log.yml` does not exist
- **THEN** the CLI SHALL print an error indicating the rule was not found
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Rules delete does not require authentication

The `taskless rules delete` command SHALL NOT require an auth token. It operates only on local files.

#### Scenario: Delete works without auth

- **WHEN** a user runs `taskless rules delete <id>` with no token available
- **THEN** the CLI SHALL proceed with the deletion without checking for authentication

### Requirement: Rules delete accepts the id argument

The `taskless rules delete` command SHALL accept a positional argument specifying the rule ID to delete. The ID SHALL match the filename stem (without `.yml` extension) in `.taskless/rules/`.

#### Scenario: ID matches filename

- **WHEN** a user runs `taskless rules delete no-console-log`
- **THEN** the CLI SHALL look for `.taskless/rules/no-console-log.yml`
