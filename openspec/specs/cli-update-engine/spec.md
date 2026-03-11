# CLI Update Engine

## Purpose

TBD — Defines the `update-engine` subcommand for the Taskless CLI, which requests scaffold upgrades from the Taskless backend.

## Requirements

### Requirement: Update-engine subcommand requests scaffold upgrade from backend

The CLI SHALL support a `taskless update-engine` subcommand that requests a scaffold upgrade PR from the Taskless backend to update the `.taskless/` engine directory. The command SHALL POST to `/cli/api/update-engine` with the project's `orgId`, `repositoryUrl`, and current `version` from `.taskless/taskless.json`. The command SHALL require authentication via the existing `getToken()` utility.

#### Scenario: Successful upgrade request creates a PR

- **WHEN** a user runs `taskless update-engine` in a project with a stale spec version
- **THEN** the CLI SHALL POST to `/cli/api/update-engine` with `orgId`, `repositoryUrl`, and `version`
- **AND** poll `GET /cli/api/update-engine/:requestId` until a PR is created
- **AND** print the PR URL to stdout

#### Scenario: Project is already current

- **WHEN** a user runs `taskless update-engine` and the API returns `{ "status": "current" }`
- **THEN** the CLI SHALL print a message indicating the project is already up to date
- **AND** exit with code 0

#### Scenario: Upgrade PR already exists

- **WHEN** a user runs `taskless update-engine` and the API returns `{ "status": "exists", "requestId": "<id>", "prUrl": "<url>" }`
- **THEN** the CLI SHALL print the existing PR URL
- **AND** exit with code 0

#### Scenario: Upgrade requires authentication

- **WHEN** a user runs `taskless update-engine` with no token available
- **THEN** the CLI SHALL print an error indicating authentication is required
- **AND** suggest running `taskless auth login`
- **AND** exit with a non-zero exit code

#### Scenario: Upgrade requires project config

- **WHEN** a user runs `taskless update-engine` and `.taskless/taskless.json` is missing or lacks `orgId`/`repositoryUrl`
- **THEN** the CLI SHALL print an error indicating the required fields
- **AND** exit with a non-zero exit code

### Requirement: Update-engine command supports JSON output

The `taskless update-engine` command SHALL support the `--json` flag for machine-readable output. JSON output SHALL include `status`, and optionally `requestId` and `prUrl` fields matching the API response shape.

#### Scenario: JSON output for accepted upgrade that completes

- **WHEN** a user runs `taskless update-engine --json` and a PR is created after polling
- **THEN** stdout SHALL contain `{ "status": "open", "prUrl": "<url>" }`

#### Scenario: JSON output for current project

- **WHEN** a user runs `taskless update-engine --json` and the project is current
- **THEN** stdout SHALL contain `{ "status": "current" }`

#### Scenario: JSON output for existing PR

- **WHEN** a user runs `taskless update-engine --json` and a PR already exists
- **THEN** stdout SHALL contain `{ "status": "exists", "requestId": "<id>", "prUrl": "<url>" }`

### Requirement: Update-engine command polls until PR is created

The update-engine command SHALL poll `GET /cli/api/update-engine/:requestId` at a reasonable interval until the status reaches a terminal state (`open`, `merged`, or `closed`). Progress messages SHALL be written to stderr during polling.

#### Scenario: Polling shows progress

- **WHEN** the CLI is polling for an upgrade request
- **THEN** stderr SHALL display the current status (`pending`)

#### Scenario: Polling completes when PR is created

- **WHEN** the request status transitions to `open`
- **THEN** the CLI SHALL print the PR URL and exit with code 0

#### Scenario: Request reports merged

- **WHEN** the request status is `merged`
- **THEN** the CLI SHALL print a message indicating the upgrade was merged and the user should pull their branch
- **AND** exit with code 0

#### Scenario: Request reports closed

- **WHEN** the request status is `closed`
- **THEN** the CLI SHALL print a message indicating the PR was closed
- **AND** exit with code 0

### Requirement: Update-engine command is non-blocking after PR creation

The update-engine command SHALL NOT block waiting for the PR to be merged. Once a PR URL is available (from creation or existing), the CLI SHALL print it and exit.

#### Scenario: CLI exits after printing PR URL

- **WHEN** the update-engine command receives a PR URL
- **THEN** the CLI SHALL print the URL and exit immediately
- **AND** SHALL NOT wait for the PR to be merged

### Requirement: Update-engine request endpoint accepts project info and returns status

The server SHALL expose `POST /cli/api/update-engine` that accepts an authenticated request with a JSON body containing `orgId` (number, required), `repositoryUrl` (string, required), and `version` (string, required — the current scaffold version). The endpoint SHALL return one of three responses based on the project's state.

#### Scenario: Project is already current

- **WHEN** the project's scaffold version is already the latest
- **THEN** the server SHALL return HTTP 200 with `{ "status": "current" }`

#### Scenario: Upgrade PR already exists

- **WHEN** an open upgrade PR already exists for this repository
- **THEN** the server SHALL return HTTP 200 with `{ "status": "exists", "requestId": "<uuid>", "prUrl": "<url>" }`

#### Scenario: Update is accepted and queued

- **WHEN** the project needs an upgrade and no PR exists
- **THEN** the server SHALL enqueue an update job and return HTTP 202 with `{ "status": "accepted", "requestId": "<uuid>" }`

#### Scenario: Organization not found

- **WHEN** a client sends a request with an `orgId` that does not resolve to a known organization
- **THEN** the server SHALL return HTTP 404 with `{ "error": "organization_not_found" }`

#### Scenario: Repository not found

- **WHEN** a client sends a request for a `repositoryUrl` not tracked by the organization
- **THEN** the server SHALL return HTTP 404 with `{ "error": "repository_not_found" }`

#### Scenario: Missing required fields

- **WHEN** a client sends a POST missing `orgId`, `repositoryUrl`, or `version`
- **THEN** the server SHALL return HTTP 400 with `{ "error": "validation_error", "details": ["..."] }`

#### Scenario: Unauthenticated request

- **WHEN** a client sends a POST without a valid `Authorization: Bearer <token>` header
- **THEN** the server SHALL return HTTP 401

### Requirement: Update-engine status endpoint returns job progress

The server SHALL expose `GET /cli/api/update-engine/:requestId` that accepts an authenticated request and returns the current status of the scaffold upgrade job. The status maps directly to the onboarding record's state.

#### Scenario: Job pending

- **WHEN** the update job has been queued but the PR has not yet been created
- **THEN** the server SHALL return `{ "status": "pending" }`

#### Scenario: PR open

- **WHEN** the update job has created a PR
- **THEN** the server SHALL return `{ "status": "open", "prUrl": "<url>" }`

#### Scenario: PR merged

- **WHEN** the upgrade PR has been merged
- **THEN** the server SHALL return `{ "status": "merged", "prUrl": "<url>" }`

#### Scenario: PR closed

- **WHEN** the upgrade PR has been closed without merging
- **THEN** the server SHALL return `{ "status": "closed", "prUrl": "<url>" }`

#### Scenario: Unknown requestId

- **WHEN** a client requests a requestId that does not exist
- **THEN** the server SHALL return HTTP 404 with `{ "error": "not_found" }`

#### Scenario: Unauthenticated request

- **WHEN** a client sends a GET without a valid `Authorization: Bearer <token>` header
- **THEN** the server SHALL return HTTP 401

### Requirement: Update-engine API supports schema introspection

The update-engine endpoints SHALL support the `x-explain: 1` request header, consistent with other `/cli/api/*` endpoints. When present, the endpoint SHALL return the JSON schema of its request/response instead of executing.

#### Scenario: Schema introspection with x-explain header

- **WHEN** a client sends a request to `/cli/api/update-engine` with the `x-explain: 1` header
- **THEN** the server SHALL return the JSON schema for the endpoint's request and response
- **AND** the server SHALL NOT require authentication
