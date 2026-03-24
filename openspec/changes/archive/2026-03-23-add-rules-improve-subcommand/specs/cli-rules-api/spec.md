## ADDED Requirements

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

## MODIFIED Requirements

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
