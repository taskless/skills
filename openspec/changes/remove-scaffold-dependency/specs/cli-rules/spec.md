# CLI Rules

## REMOVED Requirements

### Requirement: Rules create resolves orgId and repositoryUrl from project config

**Reason**: Identity is now resolved from the JWT (`orgId` claim) and git remote (`repositoryUrl`), not from `taskless.json`.

**Migration**: Replace `readProjectConfig()` + `validateRulesConfig()` calls with `resolveIdentity()`.

### Requirement: Rules create requires a minimum scaffold version

**Reason**: Scaffold version gating is removed. Feature availability is determined by CLI version.

**Migration**: Remove the `MIN_SCAFFOLD_VERSION` check from the `rules create` command entry point.

## MODIFIED Requirements

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
