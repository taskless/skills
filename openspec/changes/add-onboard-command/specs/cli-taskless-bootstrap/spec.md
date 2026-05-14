## MODIFIED Requirements

### Requirement: Install manifest schema is a recognized top-level field

The `TasklessManifest` type in `packages/cli/src/filesystem/migrate.ts` SHALL be extended to include an optional `install` field with the following shape:

```ts
interface TasklessManifest {
  version: number;
  install?: {
    installedAt?: string;
    cliVersion?: string;
    targets?: Record<
      string,
      {
        skills?: string[];
        commands?: string[];
      }
    >;
    onboarded?: boolean;
  };
}
```

The `install.onboarded` field is optional and three-state: absent (never explicitly onboarded), `false` (explicitly reset), or `true` (user confirmed onboarding is complete). The `taskless init` install path SHALL NOT set this field. The field SHALL only be written by the `taskless onboard --mark-complete` subcommand, which is invoked by the host agent only after explicit user confirmation. Reads of `taskless.json` SHALL preserve unknown fields on round-trip writes so the manifest remains forward-compatible with future migrations.

#### Scenario: Install field round-trips through read/write

- **WHEN** `taskless.json` contains an `install` object
- **AND** the CLI reads the manifest and writes it back
- **THEN** the `install` object SHALL be preserved verbatim

#### Scenario: Unknown fields are preserved on write

- **WHEN** `taskless.json` contains an unknown top-level field (e.g., `experimental: {...}`)
- **AND** the CLI writes the manifest after a version bump
- **THEN** the unknown field SHALL still be present in the output

#### Scenario: Onboarded field round-trips through read/write

- **WHEN** `taskless.json` contains `install.onboarded: true`
- **AND** the CLI reads the manifest and writes it back (e.g., as part of a re-install)
- **THEN** the `install.onboarded: true` value SHALL be preserved

#### Scenario: Init does not set onboarded

- **WHEN** `taskless init` runs against a project with no prior `install.onboarded` value
- **THEN** the resulting `taskless.json` SHALL NOT contain an `install.onboarded` field

## ADDED Requirements

### Requirement: Onboarded field semantics are 3-state and consent-gated

The optional `install.onboarded` boolean field on the install manifest SHALL be interpreted by all readers as three meaningful states:

| Value   | Meaning                                                               |
| ------- | --------------------------------------------------------------------- |
| absent  | Never explicitly onboarded (the post-install default)                 |
| `false` | Explicitly reset (treated equivalently to absent for gating purposes) |
| `true`  | User confirmed onboarding is complete                                 |

The field SHALL only be written by the `taskless onboard --mark-complete` subcommand. No other CLI code path (including `taskless init`, the wizard, and any future migration) SHALL write or set this field automatically. The field MAY be edited manually by an advanced user; such edits are out of scope for the CLI's guarantees.

#### Scenario: Absent and false both gate as "not onboarded"

- **WHEN** any consumer of the manifest reads `install.onboarded`
- **AND** the field is absent OR `false`
- **THEN** the consumer SHALL treat the user as not yet onboarded for any gating purpose

#### Scenario: True gates as "onboarded"

- **WHEN** any consumer of the manifest reads `install.onboarded`
- **AND** the field is `true`
- **THEN** the consumer SHALL treat the user as onboarded

#### Scenario: No CLI path writes onboarded except mark-complete

- **WHEN** the codebase is searched for writes to `install.onboarded`
- **THEN** the only producer SHALL be the `taskless onboard --mark-complete` subcommand
