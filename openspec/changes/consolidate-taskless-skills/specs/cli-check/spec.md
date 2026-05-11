# CLI Check

## ADDED Requirements

### Requirement: Check accepts --anonymous as a no-op

The `taskless check` command SHALL accept the global `--anonymous` flag (per the `cli` capability) without changing its behavior. `check` does not call the Taskless API, so the flag is effectively a no-op for this command.

#### Scenario: check --anonymous behaves identically to check

- **WHEN** a user runs `taskless check --anonymous`
- **THEN** the CLI SHALL execute the same logic as `taskless check`
- **AND** SHALL produce identical output (no warning, no error)
- **AND** SHALL exit with the same code as `taskless check` would

### Requirement: Check error output uses standardized error envelope

When `taskless check --json` exits with an error, the output SHALL conform to the standardized error envelope `{ "ok": false, "code": "<CODE>", "message": "<...>" }` per the `cli` capability requirements. Existing success-shape requirements for `--json` are unchanged.

#### Scenario: check --json error uses standardized envelope

- **WHEN** `taskless check --json` fails (e.g. ast-grep invocation error)
- **THEN** stdout SHALL contain a JSON object matching the standardized error envelope
- **AND** SHALL include a stable `code` field (e.g. `SCAN_FAILED` if added to the enum)
