## Context

The CLI currently validates `--from` input with manual `typeof` checks and produces `--json` output via ad-hoc `JSON.stringify({...})` calls. There is no formal contract an agent can inspect at runtime. The OpenAPI spec at `.generated/schema.json` describes the API layer, but the CLI's interface differs — it abstracts away fields like `orgId` and `repositoryUrl`, polls to completion, and synthesizes different output shapes.

Four commands support `--json` today: `rules create`, `rules improve`, `check`, and `update-engine`. Two of those (`rules create`, `rules improve`) also accept structured JSON input via `--from`.

## Goals / Non-Goals

**Goals:**

- Agents can run `taskless <command> --schema` to discover input, output, and error JSON Schemas
- Zod becomes the single source of truth for CLI I/O shapes — validation and schema generation from one definition
- `--schema` short-circuits all other logic (no auth, no config, no network)

**Non-Goals:**

- Exposing the raw OpenAPI spec through the CLI
- Generating Zod schemas from the OpenAPI spec (the CLI schemas describe a different contract)
- Adding `--schema` to commands without `--json` (e.g., `auth login`, `rules delete`)
- Changing the actual shapes of existing `--json` output (this is additive only)

## Decisions

### 1. Zod as the schema source of truth

**Decision:** Define Zod schemas for each command's input, output, and error shapes. Use `zod-to-json-schema` to convert them for `--schema` output. Use `.parse()` for runtime validation of `--json` output.

**Alternatives considered:**

- Hand-written JSON Schema files: two sources of truth, no runtime validation benefit
- Derive from OpenAPI spec: CLI shapes differ from API shapes (CLI omits `orgId`/`repositoryUrl` from input, synthesizes output after polling)

**Rationale:** Zod gives us validation + schema generation from one definition. The manual `typeof` checks in `rules create`/`rules improve` become `.parse()` calls, which is both stricter and less code.

### 2. Schema files co-located with commands

**Decision:** Create a `packages/cli/src/schemas/` directory with one file per command group. Each file exports Zod schemas for input (if applicable), output, and error.

```
packages/cli/src/schemas/
├── rules-create.ts    # inputSchema, outputSchema, errorSchema
├── rules-improve.ts   # inputSchema, outputSchema, errorSchema
├── check.ts           # outputSchema, errorSchema
└── update-engine.ts   # outputSchema, errorSchema
```

**Alternatives considered:**

- Inline schemas in command files: makes commands longer, harder to find schemas
- Single schemas.ts file: gets unwieldy as commands grow

**Rationale:** Separate directory keeps schemas discoverable. One file per command keeps each small and focused.

### 3. `--schema` short-circuits before all other logic

**Decision:** Check `args.schema` at the top of each command's `run()` function, before auth, config reading, or any other work. Print the three schema blocks and `process.exit(0)`.

**Rationale:** An agent asking "what do you expect?" should never hit auth errors or config requirements. This matches the mental model of `--help`.

### 4. Three-block output format

**Decision:** `--schema` outputs three labeled sections — Input Schema, Output Schema, Error Schema — each containing a JSON Schema object. For commands without `--from` input, the Input Schema section reads "This command does not accept JSON input."

**Rationale:** Agents need all three to construct correct calls and handle both success and failure. Labels make it unambiguous which is which.

### 5. `--schema` flag registered globally but only effective on `--json` commands

**Decision:** Add `--schema` as a global arg (like `--json` and `--dir`) in the main command definition. Commands without `--json` simply ignore it. Commands with `--json` check it and short-circuit.

**Alternatives considered:**

- Per-command `--schema` arg: more explicit, but duplicates the arg definition across every command
- Top-level `schema` subcommand with mirrored tree: maintenance burden of parallel command hierarchy

**Rationale:** Global arg is consistent with how `--json` works today. No tree duplication.

### 6. Zod validates `--json` output at runtime

**Decision:** Wrap `JSON.stringify` calls with `schema.parse()` so that if the output shape ever drifts from the schema, it fails loudly during development rather than silently producing incorrect schema documentation.

**Rationale:** Without this, schemas and output could drift. The parse call is cheap and catches regressions.

## Risks / Trade-offs

- **New dependencies (zod, zod-to-json-schema):** Increases bundle size. → Mitigation: Both are tree-shakeable and Vite will only include what's used. Zod is ~13KB minified.
- **Output validation overhead:** `.parse()` on every `--json` invocation adds a small cost. → Mitigation: Negligible for CLI output sizes. The schemas are simple flat objects.
- **Schema maintenance:** Each new command with `--json` needs schemas. → Mitigation: Clear pattern to follow (copy existing schema file, adjust). TypeScript will catch missing schemas if commands reference them.
- **Format of --schema output is not itself JSON:** The three labeled blocks aren't a single parseable JSON object. → Mitigation: Each block is individually valid JSON. Agents can split on the labels. This was a deliberate choice for human readability alongside machine use.
