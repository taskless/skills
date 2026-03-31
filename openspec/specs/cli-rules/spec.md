# CLI Rules

## Purpose

Defines the `rules` subcommand group for the Taskless CLI, including `create`, `improve`, `delete`, and `verify` subcommands for managing ast-grep rules. Also documents the server-side API contract for rule generation endpoints.

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

### Requirement: Rules create resolves identity from JWT and git remote

The `taskless rules create` command SHALL resolve `orgId` and `repositoryUrl` using the `resolveIdentity()` function. `orgId` SHALL be extracted from the JWT's `orgId` claim (decoded via `jose`). `repositoryUrl` SHALL be inferred from `git remote get-url origin`, canonicalized to `https://github.com/{owner}/{repo}`. If identity resolution fails, the CLI SHALL print a descriptive error and exit with a non-zero exit code.

#### Scenario: Identity resolved from JWT and git remote

- **WHEN** the stored JWT contains an `orgId` claim and the repository has a valid GitHub `origin` remote
- **THEN** the CLI SHALL use the JWT's `orgId` and the inferred `repositoryUrl` in the API request

#### Scenario: JWT lacks orgId (stale token)

- **WHEN** the stored JWT does not contain an `orgId` claim
- **THEN** the CLI SHALL print an error: "Your auth token is missing organization info. Run `taskless auth login` to re-authenticate."
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Git remote not available

- **WHEN** `git remote get-url origin` fails
- **THEN** the CLI SHALL print an error about the missing git remote
- **AND** the CLI SHALL exit with a non-zero exit code

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

### Requirement: Codegen script fetches official ast-grep rule schema

A codegen script (`packages/cli/scripts/fetch-ast-grep-schema.ts`) SHALL fetch the official ast-grep rule JSON Schema from GitHub and store it as a generated artifact committed to git. The schema version SHALL be pinned to the `@ast-grep/cli` version specified in `packages/cli/package.json`. The script is run manually via `pnpm generate:ast-grep-schema` when the ast-grep version is bumped.

#### Scenario: Codegen fetches schema from GitHub

- **WHEN** the codegen script is executed
- **THEN** it SHALL fetch `https://raw.githubusercontent.com/ast-grep/ast-grep/{VERSION}/schemas/rule.json` where `{VERSION}` is the `@ast-grep/cli` version from `packages/cli/package.json`
- **AND** write the result to `packages/cli/src/generated/ast-grep-rule-schema.json`

#### Scenario: Generated schema includes metadata comment

- **WHEN** the schema file is generated
- **THEN** it SHALL include a `$comment` field with the generation timestamp, ast-grep version, and source URL

#### Scenario: Generated schema is committed to git

- **WHEN** the codegen script completes
- **THEN** the generated file SHALL be committed to the repository alongside other generated artifacts in `packages/cli/src/generated/`

### Requirement: Schema version is pinned to ast-grep dependency

The codegen script SHALL extract the ast-grep version from `packages/cli/package.json` dependencies. The version extraction SHALL handle semver range prefixes (e.g., `^0.41.0` resolves to `0.41.0`).

#### Scenario: Version extracted from package.json

- **WHEN** `packages/cli/package.json` has `"@ast-grep/cli": "^0.41.0"` in dependencies
- **THEN** the codegen script SHALL fetch the schema for version `0.41.0`

#### Scenario: Codegen fails gracefully on network error

- **WHEN** the GitHub fetch fails (network error, 404, etc.)
- **THEN** the codegen script SHALL exit with a non-zero code and a descriptive error message
- **AND** SHALL NOT overwrite an existing generated schema file

### Requirement: Generated schema is importable at build time

The generated JSON Schema file SHALL be importable by the CLI bundle via Vite. The import SHALL make the full JSON Schema object available at runtime without filesystem reads or network fetches.

#### Scenario: Schema imported in verify command

- **WHEN** the `rules verify` command needs the ast-grep schema
- **THEN** it SHALL import the schema from `../generated/ast-grep-rule-schema.json`
- **AND** the schema object SHALL be available synchronously at runtime

### Requirement: Verify subcommand validates rules against ast-grep schema

The CLI SHALL support a `taskless rules verify` subcommand that validates a rule file against the ast-grep Zod schema, applies Taskless-specific requirements, and runs test cases. The subcommand SHALL accept a positional `<id>` argument identifying the rule to verify.

#### Scenario: Verify a valid rule with passing tests

- **WHEN** a user runs `taskless rules verify no-eval`
- **THEN** the CLI SHALL read `.taskless/rules/no-eval.yml`
- **AND** validate it against the ast-grep Zod schema
- **AND** check Taskless-specific requirements
- **AND** run `sg test` for the rule's test cases
- **AND** report success with a summary of checks passed

#### Scenario: Verify a rule that fails schema validation

- **WHEN** a user runs `taskless rules verify bad-rule` and the rule YAML contains unknown fields or invalid types
- **THEN** the CLI SHALL report the specific schema validation errors
- **AND** exit with code 1

#### Scenario: Verify a rule with no test file

- **WHEN** a user runs `taskless rules verify orphan-rule` and no matching test file exists in `.taskless/rule-tests/`
- **THEN** the CLI SHALL report a Taskless requirement failure: missing test file
- **AND** skip the test execution layer

#### Scenario: Verify a nonexistent rule

- **WHEN** a user runs `taskless rules verify nonexistent`
- **THEN** the CLI SHALL report that `.taskless/rules/nonexistent.yml` was not found
- **AND** exit with code 1

### Requirement: Verify performs three layers of validation

The verify subcommand SHALL execute validation in three sequential layers: (1) Zod schema validation against the ast-grep rule schema, (2) Taskless requirement checks, and (3) test execution via `sg test`. If an earlier layer fails, subsequent layers SHALL still execute to provide complete feedback.

#### Scenario: Layer 1 — Schema validation

- **WHEN** the rule file is parsed as YAML
- **THEN** the CLI SHALL validate the resulting object against the ast-grep Zod schema
- **AND** report all validation errors with field paths

#### Scenario: Layer 2 — Taskless requirement checks

- **WHEN** the rule passes or fails schema validation
- **THEN** the CLI SHALL additionally check that `id`, `language`, `severity`, `message`, and `rule` fields are present
- **AND** check that any rule using `regex` also specifies `kind` at the same level
- **AND** check that a matching test file exists in `.taskless/rule-tests/`

#### Scenario: Layer 3 — Test execution via sg test

- **WHEN** a matching test file exists
- **THEN** the CLI SHALL generate `sgconfig.yml` via `generateSgConfig()`
- **AND** run `sg test --config .taskless/sgconfig.yml` using the existing `findSgBinary()` resolver
- **AND** parse the output to report pass/fail counts for valid and invalid test cases

#### Scenario: All layers run regardless of earlier failures

- **WHEN** Layer 1 reports schema errors
- **THEN** Layer 2 and Layer 3 SHALL still execute
- **AND** the output SHALL include results from all three layers

### Requirement: Verify supports JSON output

The verify subcommand SHALL support the global `--json` flag. When enabled, the output SHALL be a JSON object with per-layer results.

#### Scenario: JSON output for successful verification

- **WHEN** a user runs `taskless rules verify no-eval --json`
- **THEN** the CLI SHALL output a JSON object with structure: `{ "success": true, "ruleId": "no-eval", "schema": { "valid": true, "errors": [] }, "requirements": { "valid": true, "checks": [...] }, "tests": { "valid": true, "passed": <n>, "failed": 0 } }`

#### Scenario: JSON output for failed verification

- **WHEN** a user runs `taskless rules verify bad-rule --json` and the rule fails Layer 2
- **THEN** the CLI SHALL output a JSON object with `"success": false` and the failing layer SHALL have `"valid": false` with descriptive error entries

### Requirement: Verify schema mode dumps combined schema for agent consumption

The verify subcommand SHALL support a `--schema` flag that dumps the combined ast-grep schema, Taskless requirements, and annotated examples as JSON. When `--schema` is provided, no rule ID is required and no validation is performed.

#### Scenario: Schema output with --schema flag

- **WHEN** a user runs `taskless rules verify --schema --json`
- **THEN** the CLI SHALL output a JSON object with three top-level keys: `astGrepSchema` (the full official ast-grep rule JSON Schema for agent reference), `tasklessRequirements` (required fields and additional rules), and `examples` (curated annotated rule examples)
- **AND** exit with code 0

#### Scenario: Schema output includes curated examples

- **WHEN** the `--schema` output is examined
- **THEN** the `examples` array SHALL include at least: a simple pattern match example, a regex-with-kind example, and a composite rule using `any`/`all`

#### Scenario: Schema flag does not require auth

- **WHEN** a user runs `taskless rules verify --schema` without being authenticated
- **THEN** the command SHALL succeed without requiring a token

### Requirement: Verify respects global flags

The verify subcommand SHALL respect the global `-d` (working directory) and `--schema` (print Zod schemas) flags consistent with other CLI subcommands.

#### Scenario: Verify uses custom directory

- **WHEN** a user runs `taskless rules verify no-eval -d /path/to/repo`
- **THEN** the CLI SHALL look for `.taskless/rules/no-eval.yml` in `/path/to/repo`

#### Scenario: Verify --schema prints Zod schemas

- **WHEN** a user runs `taskless rules verify --schema` (without `--json`)
- **THEN** the CLI SHALL print the combined schema payload in the standard `--schema` output format

## API Contract

### Requirement: Rule generation request endpoint accepts a request and returns a requestId

The server SHALL expose `POST /cli/api/rule` that accepts an authenticated request with a JSON body containing `orgId` (number, required), `repositoryUrl` (string, required), `prompt` (string, required), `successCases` (array of strings, optional), and `failureCases` (array of strings, optional). The endpoint SHALL return a JSON response containing `ruleId` (string) and `status` set to `"accepted"`.

#### Scenario: Valid request returns a ruleId

- **WHEN** an authenticated client sends a POST to `/cli/api/rule` with valid `orgId`, `repositoryUrl`, and `prompt`
- **THEN** the server SHALL return HTTP 200 with `{ ruleId: string, status: "accepted" }`

#### Scenario: Request with example arrays

- **WHEN** an authenticated client includes `successCases` and `failureCases` arrays
- **THEN** the server SHALL accept the arrays and use them for rule generation context

#### Scenario: Missing required fields

- **WHEN** a client sends a POST missing `orgId`, `repositoryUrl`, or `prompt`
- **THEN** the server SHALL return HTTP 400 with `{ error: "validation_error", details: string[] }`

#### Scenario: Unauthenticated request

- **WHEN** a client sends a POST without a valid `Authorization: Bearer <token>` header
- **THEN** the server SHALL return HTTP 401

#### Scenario: Repository not accessible

- **WHEN** the `repositoryUrl` is not accessible to the specified organization
- **THEN** the server SHALL return HTTP 403 with `{ error: "repository_not_accessible" }`

#### Scenario: Organization not found

- **WHEN** the `orgId` does not match a known organization
- **THEN** the server SHALL return HTTP 404 with `{ error: "organization_not_found" }`

### Requirement: Iterate endpoint accepts guidance and returns a requestId

The server SHALL expose `POST /cli/api/rule/{ruleId}/iterate` that accepts an authenticated request with a JSON body containing `orgId` (number, required), `guidance` (string, required), and `references` (array of `{ filename: string, content: string }`, optional). The endpoint SHALL return a JSON response containing `requestId` (string) and `status` set to `"accepted"`. The `requestId` SHALL be usable with the existing `GET /cli/api/rule/{requestId}` polling endpoint.

#### Scenario: Valid iterate request returns a requestId

- **WHEN** an authenticated client sends a POST to `/cli/api/rule/{ruleId}/iterate` with valid `orgId` and `guidance`
- **THEN** the server SHALL return HTTP 200 with `{ requestId: string, status: "accepted" }`

#### Scenario: Missing required fields

- **WHEN** a client sends a POST missing `orgId` or `guidance`
- **THEN** the server SHALL return HTTP 400 with `{ error: "validation_error", details: string[] }`

#### Scenario: Rule not found

- **WHEN** the `ruleId` does not match a known rule generation request
- **THEN** the server SHALL return HTTP 404 with `{ error: "request_not_found" }`

#### Scenario: Access denied

- **WHEN** the authenticated user does not have access to the specified rule
- **THEN** the server SHALL return HTTP 403 with `{ error: "access_denied" }`

#### Scenario: Organization not found

- **WHEN** the `orgId` does not match a known organization
- **THEN** the server SHALL return HTTP 404 with `{ error: "organization_not_found" }`

### Requirement: Request status endpoint returns generation progress

The server SHALL expose `GET /cli/api/request/:requestId` that accepts an authenticated request and returns the current status of the rule generation job. The status SHALL progress through `accepted` → `building` → `generated` (or `failed`).

#### Scenario: Generation accepted

- **WHEN** the rule generation job has been queued but not started
- **THEN** the server SHALL return `{ requestId, status: "accepted" }`

#### Scenario: Generation building

- **WHEN** the rule generation job is actively processing
- **THEN** the server SHALL return `{ requestId, status: "building" }`

#### Scenario: Generation complete

- **WHEN** the rule generation job has completed successfully
- **THEN** the server SHALL return `{ requestId, status: "generated", rules: GeneratedRule[] }`

#### Scenario: Generation failed

- **WHEN** the rule generation job has failed
- **THEN** the server SHALL return `{ requestId, status: "failed", error: string }`

#### Scenario: Unknown requestId

- **WHEN** a client requests a requestId that does not exist
- **THEN** the server SHALL return HTTP 404 with `{ error: "request_not_found" }`

#### Scenario: Access denied

- **WHEN** the authenticated user does not have access to the specified request
- **THEN** the server SHALL return HTTP 403 with `{ error: "access_denied" }`

#### Scenario: Unauthenticated request

- **WHEN** a client sends a GET without a valid `Authorization: Bearer <token>` header
- **THEN** the server SHALL return HTTP 401

### Requirement: Generated rule content follows ast-grep schema

Each rule in the `rules` array SHALL contain an `id` (string), a `content` object matching the ast-grep rule schema, and an optional `tests` object. The `content` object SHALL include at minimum `id` (string), `language` (string), and `rule` (object). It MAY include `severity`, `message`, `note`, `fix`, `constraints`, `utils`, `transform`, `metadata`, `files`, `ignores`, and `url`.

#### Scenario: Minimal rule content

- **WHEN** a rule is generated with minimal configuration
- **THEN** `content` SHALL contain `id`, `language`, and `rule`

#### Scenario: Full rule content

- **WHEN** a rule is generated with all optional fields
- **THEN** `content` SHALL contain all applicable fields from the ast-grep schema

### Requirement: Generated rules may include test cases

Each rule in the `rules` array MAY include a `tests` object containing `valid` (array of strings — code that should NOT trigger the rule) and `invalid` (array of strings — code that SHOULD trigger the rule).

#### Scenario: Rule with test cases

- **WHEN** the generator produces test cases for a rule
- **THEN** the rule SHALL include `tests` with non-empty `valid` and `invalid` arrays

#### Scenario: Rule without test cases

- **WHEN** the generator does not produce test cases
- **THEN** the `tests` field SHALL be absent or undefined

### Requirement: Whoami endpoint returns user identity and organizations

The server SHALL expose `GET /cli/api/whoami` that accepts an authenticated request and returns the user's identity and associated organizations.

#### Scenario: Authenticated user

- **WHEN** an authenticated client sends a GET to `/cli/api/whoami`
- **THEN** the server SHALL return `{ user: string, email?: string, orgs: [{ orgId: number, name: string, installationId: number }] }`

#### Scenario: Unauthenticated request

- **WHEN** a client sends a GET without a valid `Authorization: Bearer <token>` header
- **THEN** the server SHALL return HTTP 401 with `{ error: "unauthorized" }`

### Requirement: API manifest endpoint lists available endpoints

The server SHALL expose `GET /cli/api` that requires no authentication and returns an array of available CLI API endpoints with their paths, methods, and descriptions.

#### Scenario: Manifest is accessible without auth

- **WHEN** a client sends a GET to `/cli/api`
- **THEN** the server SHALL return HTTP 200 with an array of endpoint descriptors

### Requirement: API endpoints support schema introspection

All `/cli/api/*` endpoints SHALL support an `x-explain: 1` request header. When present, the endpoint SHALL return the JSON schema of its request/response instead of executing, and SHALL NOT require authentication.

#### Scenario: Schema introspection with x-explain header

- **WHEN** a client sends a request to any `/cli/api/*` endpoint with the `x-explain: 1` header
- **THEN** the server SHALL return the JSON schema for that endpoint's request and response
- **AND** the server SHALL NOT require authentication
