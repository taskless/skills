## ADDED Requirements

### Requirement: Migration 2 initializes an empty install object

Migration `"2"` SHALL be registered in the migration runner. Its behavior is idempotent: if `taskless.json` does not yet contain an `install` field, migration 2 SHALL add `install: {}` as a top-level object. If the field is already present, migration 2 SHALL leave it untouched. After migration 2 runs, `taskless.json` version SHALL be updated to `2` by the migration runner's existing finalization logic.

#### Scenario: Fresh project has install object after bootstrap

- **WHEN** `ensureTasklessDirectory()` is called in a project without a prior `.taskless/` directory
- **THEN** `taskless.json` SHALL be created with `{ "version": 2, "install": {} }`

#### Scenario: Existing v1 project is forward-migrated

- **WHEN** `ensureTasklessDirectory()` is called in a project whose existing `taskless.json` is at version `1`
- **THEN** the migration runner SHALL invoke migration 2
- **AND** `taskless.json` SHALL contain `install: {}`
- **AND** `taskless.json` version SHALL be `2`

#### Scenario: Migration 2 preserves existing install object

- **WHEN** `ensureTasklessDirectory()` is called in a project whose `taskless.json` already contains an `install` object (e.g., from a prior run of migration 2 that partially completed)
- **THEN** migration 2 SHALL NOT overwrite the existing `install` object

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
  };
}
```

Reads of `taskless.json` SHALL preserve unknown fields on round-trip writes so the manifest remains forward-compatible with future migrations.

#### Scenario: Install field round-trips through read/write

- **WHEN** `taskless.json` contains an `install` object
- **AND** the CLI reads the manifest and writes it back
- **THEN** the `install` object SHALL be preserved verbatim

#### Scenario: Unknown fields are preserved on write

- **WHEN** `taskless.json` contains an unknown top-level field (e.g., `experimental: {...}`)
- **AND** the CLI writes the manifest after a version bump
- **THEN** the unknown field SHALL still be present in the output
