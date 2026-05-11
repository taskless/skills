# CLI Schema

## REMOVED Requirements

### Requirement: Zod schemas define CLI I/O contracts

**Reason**: Zod schemas remain as the single source of truth for I/O contracts — only the user-facing surface changes. The requirement language is replaced by per-command requirements in `cli-rules` and `cli-help` (recipe schema embedding).

**Migration**: Zod schemas continue to live at `packages/cli/src/schemas/`. They are now consumed by the help command (which embeds them as JSON Schema in recipe output via `zod-to-json-schema`) rather than by a `--schema` flag.

### Requirement: Input schemas match --from JSON shapes

**Reason**: Same as above. Schema-to-implementation parity remains required; the user-facing `--schema` flag goes away.

**Migration**: Continue to maintain Zod input schemas; their JSON Schema rendering is embedded in the corresponding `tskl help <topic>` recipe output.

### Requirement: Output schemas match --json success shapes

**Reason**: Removed entirely. Action commands no longer expose `--json` success shapes for agent consumption — recipes return markdown, agents invoke and report. Action commands write outputs directly to disk per the `cli-rules` self-sufficient-writes requirements.

**Migration**: Where `--json` is still used (e.g. `info --json`, `check --json`, error output), the shape is documented inline in the corresponding recipe.

### Requirement: Error schemas match --json failure shapes

**Reason**: Replaced by the new standardized error code contract in `cli` capability ("Error output uses stable codes when --json is set"). Recipes reference error codes by name in their `## Errors` section; the codes themselves are stable.

**Migration**: See `cli` capability for the standardized error envelope `{ ok: false, code: "<CODE>", message: "<...>" }`.

### Requirement: --schema short-circuits command execution

**Reason**: The `--schema` flag is removed entirely.

**Migration**: Schemas are obtained by fetching the relevant `tskl help <topic>` recipe and reading the embedded JSON Schema code-fenced block.

### Requirement: --schema output format

**Reason**: The `--schema` flag is removed entirely.

**Migration**: See above.

### Requirement: JSON Schema generation uses zod-to-json-schema

**Reason**: The JSON Schema generation requirement moves to `cli-help` (where schemas are now embedded in recipe output).

**Migration**: `zod-to-json-schema` continues to be the conversion library; the dependency moves into the help-command code path. See `cli-help` for the new requirement.

### Requirement: --from input validated via Zod

**Reason**: This requirement remains true but is governed by the per-command spec (`cli-rules`) rather than this capability.

**Migration**: `cli-rules` retains the `--from` input validation requirement for `rule create` and `rule improve`.

### Requirement: --json output validated via Zod

**Reason**: Where `--json` is still used (info, check), validation continues. The requirement language moves to per-command specs.

**Migration**: See `cli-check` and `cli-info` (within `cli` capability) for the surviving `--json` output requirements.
