# CLI

## ADDED Requirements

### Requirement: CLI accepts global --anonymous flag with per-command behavior

The CLI SHALL accept a top-level boolean flag `--anonymous` on every subcommand. The flag's behavior SHALL vary by command:

- `rule create`, `rule improve`: switch to local-only flow (no API calls); SHALL be the only way to reach the local-only path
- `rule delete`, `rule verify`, `rule meta`, `check`, `auth logout`, `init`, `update`: accepted as no-op; SHALL succeed without changing behavior
- `info`: skip the API/auth probe; report local state only (CLI version, skills installed, no auth call)
- `auth login`: SHALL exit with code 1 and an error message stating "auth commands cannot be anonymous"

The flag SHALL be recognized whether placed before or after positional arguments (per `citty` parsing).

#### Scenario: --anonymous on rule create switches to local flow

- **WHEN** a user runs `taskless rule create --from req.json --anonymous`
- **THEN** the CLI SHALL execute the local-only branch (no API calls)
- **AND** SHALL produce the same output shape as the API-backed branch

#### Scenario: --anonymous on check is a no-op

- **WHEN** a user runs `taskless check --anonymous`
- **THEN** the CLI SHALL execute identically to `taskless check` (no warning, no error)

#### Scenario: --anonymous on info skips API probe

- **WHEN** a user runs `taskless info --anonymous`
- **THEN** the CLI SHALL report local state only (CLI version, installed skills, scaffold version)
- **AND** SHALL NOT make any HTTP request to verify auth state

#### Scenario: --anonymous on auth login is rejected

- **WHEN** a user runs `taskless auth login --anonymous`
- **THEN** the CLI SHALL exit with code 1
- **AND** SHALL print an error message stating "auth commands cannot be anonymous"

### Requirement: Error output uses stable codes when --json is set

When any CLI command exits with an error AND `--json` was passed, the command SHALL output a JSON envelope with the shape:

```json
{
  "ok": false,
  "code": "<STABLE_CODE>",
  "message": "<human-readable message>"
}
```

The `code` field SHALL be drawn from a stable enum defined in `packages/cli/src/types/errors.ts`. The enum SHALL include at minimum: `AUTH_REQUIRED`, `NO_GITHUB_REMOTE`, `RULE_GENERATION_FAILED`, `RULE_NOT_FOUND`, `INVALID_INPUT`, `NETWORK_ERROR`. New codes MAY be added but existing codes SHALL NOT be renamed without a major version bump. Recipes reference these codes by name in their `## Errors` section, so stability is required.

#### Scenario: Auth-required error in JSON mode

- **WHEN** a user runs `taskless rule create --from req.json --json` while logged out
- **THEN** stdout SHALL contain `{ "ok": false, "code": "AUTH_REQUIRED", "message": "..." }`
- **AND** the exit code SHALL be non-zero

#### Scenario: Error code stability is enforced by tests

- **WHEN** the test suite runs
- **THEN** there SHALL be tests verifying the exact `code` strings emitted for each error path
- **AND** renaming a code in the enum without updating both the implementation and the tests SHALL break the build
