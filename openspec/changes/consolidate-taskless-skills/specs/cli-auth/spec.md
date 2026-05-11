# CLI Auth

## MODIFIED Requirements

### Requirement: Auth login initiates Device Flow

`taskless auth login` initiates the device-code flow per the existing requirement. The new `--anonymous` flag (per the `cli` capability) SHALL NOT be accepted on this command — invocation with `--anonymous` SHALL exit with code 1 and an error message stating "auth commands cannot be anonymous".

#### Scenario: Standard login still works

- **WHEN** a user runs `taskless auth login`
- **THEN** the CLI SHALL initiate the device-code flow per the existing behavior

#### Scenario: Login rejects --anonymous

- **WHEN** a user runs `taskless auth login --anonymous`
- **THEN** the CLI SHALL exit with code 1
- **AND** SHALL print "auth commands cannot be anonymous" (or similar)

### Requirement: Auth logout removes saved token

`taskless auth logout` removes the saved token per the existing requirement. The `--anonymous` flag SHALL be accepted as a no-op on this command (logout is already a local operation requiring no API state).

#### Scenario: Standard logout still works

- **WHEN** a user runs `taskless auth logout`
- **THEN** the CLI SHALL remove the saved token per the existing behavior

#### Scenario: Logout accepts --anonymous as no-op

- **WHEN** a user runs `taskless auth logout --anonymous`
- **THEN** the CLI SHALL behave identically to `taskless auth logout`

## ADDED Requirements

### Requirement: Auth error output uses standardized error envelope

When any `taskless auth` subcommand exits with an error AND `--json` was passed, the output SHALL conform to the standardized error envelope `{ "ok": false, "code": "<CODE>", "message": "<...>" }` per the `cli` capability requirements.

#### Scenario: Auth login network failure in JSON mode

- **WHEN** `taskless auth login --json` fails due to a network error
- **THEN** stdout SHALL contain `{ "ok": false, "code": "NETWORK_ERROR", "message": "..." }`
- **AND** the exit code SHALL be non-zero
