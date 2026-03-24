# CLI Rules API

## Purpose

TBD — Defines the server-side API contract for CLI rule generation. This is a spec-only capability documenting the endpoints the CLI interacts with; implementation lives outside this repository.

## Requirements

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
