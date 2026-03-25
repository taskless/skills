## Why

AI agents that invoke the Taskless CLI need a machine-readable way to discover what JSON input a command expects (`--from`) and what JSON output it produces (`--json`), including error shapes. Today agents rely on help text or out-of-band documentation, which is fragile and drifts from the actual implementation.

## What Changes

- Add a `--schema` flag to every CLI command that supports `--json`
- `--schema` short-circuits execution (like `--help`): prints input, output, and error JSON Schemas to stdout, then exits 0 — no auth, no config, no side effects
- Introduce Zod schemas as the single source of truth for:
  - `--from` input validation (replacing manual `typeof` checks)
  - `--json` output validation (wrapping existing `JSON.stringify` calls)
  - `--schema` output (via `zod-to-json-schema` conversion)
- Output format is three labeled blocks:

  ```
  Input Schema:
  { ... }

  Output Schema:
  { ... }

  Error Schema:
  { ... }
  ```

  Where "Input Schema" shows the `--from` JSON shape (or a message if the command has no JSON input), "Output Schema" shows the success `--json` shape, and "Error Schema" shows the failure `--json` shape.

## Capabilities

### New Capabilities

- `cli-schema`: Defines the `--schema` flag behavior, Zod schema infrastructure, and per-command schema definitions

### Modified Capabilities

- `cli`: The global argument set gains `--schema`; commands with `--json` must register their schemas

## Impact

- **packages/cli/src/commands/**: Each command with `--json` gets a `--schema` flag and Zod schemas for input/output/error
- **packages/cli/src/actions/rule-api.ts**: `RuleCreateRequest` and `RuleImproveRequest` interfaces become Zod schemas
- **packages/cli/src/actions/format.ts**: `formatJson` wraps output through Zod `.parse()`
- **packages/cli/src/types/check.ts**: `CheckResult` interface becomes a Zod schema
- **New dependency**: `zod` and `zod-to-json-schema`
- **Commands affected**: `rules create`, `rules improve`, `check`, `update-engine`
