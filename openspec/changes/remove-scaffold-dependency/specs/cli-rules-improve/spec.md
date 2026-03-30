# CLI Rules Improve

## MODIFIED Requirements

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
