## Context

Taskless v0.4.0 removed the auth requirement for core CLI operations (`check`, `init`, `info`), but rule creation and improvement still require authentication because they delegate rule generation to the Taskless API. The codebase currently has:

- **Skills** that construct JSON payloads and invoke `taskless rules create --from <file> --json` or `taskless rules improve --from <file> --json`, both of which call `resolveIdentity()` (requiring a valid JWT).
- **ast-grep** bundled as `@ast-grep/cli@^0.41.0` with platform-specific optional dependencies and a `findSgBinary()` resolver.
- **`.taskless/` directory** bootstrapped implicitly by `generateSgConfig()` and `ensureTasklessGitignore()` — no unified bootstrap.
- **Zod schemas** for CLI input/output validation, with `--schema` flags that dump JSON Schemas for agent consumption.

## Goals / Non-Goals

**Goals:**

- Enable rule creation and improvement without authentication, using the local agent to derive ast-grep rules
- Provide a `rules verify` command that validates rules against the official ast-grep schema, applies Taskless-specific checks, and runs test cases — serving as both a quality gate and an agent feedback loop
- Fetch and embed the official ast-grep rule JSON schema at build time, keeping it version-pinned to the installed `@ast-grep/cli`
- Make skill routing transparent: existing `/tskl:rule` and `/tskl:improve` commands continue to work, silently delegating to anonymous variants when not authenticated
- Unify `.taskless/` directory bootstrapping so README, gitignore, version manifest, and directory structure are created consistently on first write

**Non-Goals:**

- Replacing the API-backed rule generation for authenticated users — anonymous mode is an alternative, not a replacement
- Making anonymous rules equivalent in quality to API-generated rules — the agent-driven approach is best-effort with verification
- Supporting ast-grep schema versions other than the pinned one
- Adding interactive prompts to `init` or any CLI command

## Decisions

### 1. Schema source: official ast-grep rule.json fetched at codegen time

Fetch `https://raw.githubusercontent.com/ast-grep/ast-grep/{VERSION}/schemas/rule.json` during a codegen step, pinned to the `@ast-grep/cli` version in `package.json`. Store the result at `packages/cli/src/generated/ast-grep-rule-schema.json`. Import it at build time via Vite (similar to how skills are embedded via `import.meta.glob`).

**Why not Zod?** The ast-grep schema is 850 lines with 24 definitions. Hand-maintaining a Zod equivalent would be fragile and drift. The official JSON Schema is the source of truth — we validate against it directly.

**Why not fetch at runtime?** Build-time fetch means the schema is available offline, version-locked, and auditable in git. Follows the same pattern the backend team uses.

**Alternative considered:** Bundling a hand-written subset of the schema. Rejected because the full schema covers edge cases (rewriters, transformations, fix configs) that a subset would miss, leading to false validation passes.

### 2. Validation library: Zod for schema validation

Convert the fetched ast-grep JSON Schema into a Zod schema at codegen time using `json-schema-to-zod` or a hand-maintained Zod schema derived from the official JSON Schema. This keeps the CLI on a single validation library. The Zod schema is the runtime validator; the JSON Schema is still fetched and embedded for `--schema` output (agent consumption), but Ajv is not needed.

**Why Zod over Ajv?** The CLI already uses Zod everywhere. Adding a second validation library increases bundle size and cognitive overhead. Zod provides excellent error messages and integrates with the existing `--schema` flag infrastructure via `zod-to-json-schema`.

**Approach:** Generate a Zod schema from the official ast-grep JSON Schema during codegen. The Taskless overlay (required fields, regex-requires-kind) is layered on top as `.refine()` calls. If `json-schema-to-zod` can't handle the full complexity, a hand-maintained Zod schema covering the fields Taskless cares about (with `.passthrough()` for unknown fields) is acceptable — the `sg test` layer catches what schema validation misses.

**Alternative considered:** Using Ajv for JSON Schema validation alongside Zod. Rejected to avoid a second validation library — Zod can cover the needed validation surface, and `sg test` provides the ultimate correctness check.

### 3. `rules verify` command design

A new subcommand `taskless rules verify` with two modes:

**Schema mode** (`--schema --json`): Dumps a combined payload for agent consumption:

```json
{
  "astGrepSchema": {
    /* official rule.json */
  },
  "tasklessRequirements": {
    "requiredFields": ["id", "language", "severity", "message", "rule"],
    "rules": [
      {
        "name": "regex-requires-kind",
        "description": "Rules using regex must also specify kind at the same level"
      }
    ]
  },
  "examples": [
    /* curated, annotated rule examples */
  ]
}
```

**Verify mode** (`taskless rules verify <id> --json`): Three-layer validation:

1. **Schema validation** — parse `.taskless/rules/<id>.yml`, validate against the ast-grep Zod schema
2. **Taskless requirements** — check required fields (`id`, `language`, `severity`, `message`, `rule`), check regex-requires-kind, check test file exists
3. **Test execution** — run `sg test --config .taskless/sgconfig.yml` and parse results

Output includes per-layer pass/fail with structured error messages the agent can act on.

**Alternative considered:** Separate `rules schema` and `rules test` commands. Rejected because the agent needs a single "is this rule good?" command for the feedback loop. Splitting forces the agent to orchestrate multiple calls.

### 4. Lazy `.taskless/` bootstrap via migration system

Instead of a static bootstrap function, use a migration-based approach inspired by database migrations. `taskless.json` stores an integer `version` (default 0), and a registry of named migrations brings the directory up to date.

```ts
type Migration = (dir: string) => Promise<undefined>;
type Migrations = Record<string, Migration>;

const migrations: Migrations = {
  "001-init": async (dir) => {
    /* create README.md, .gitignore, rules/, rule-tests/ */
  },
  "002-something-future": async (dir) => {
    /* future migration */
  },
};
```

The `ensureTasklessDirectory(cwd)` function:

1. Reads `taskless.json` → `{ "version": 0 }` (or creates it with version 0 if missing)
2. Counts total migrations; if `version` >= count, returns early (already current)
3. Runs all migrations from the current version index forward
4. Each migration is idempotent (checks before writing)
5. Writes the new version to `taskless.json`

Called from any write path: `writeRuleFile`, `writeRuleTestFile`, `generateSgConfig`, and the new `rules verify` command.

Migrations are keyed as a `Record<string, Migration>` so older migrations can be safely removed once the minimum supported version advances. The string keys are for human readability; ordering is by position in the record (insertion order).

The first migration (`001-init`) handles everything the current bootstrap would: README, gitignore, directory structure.

**Why migrations over a static bootstrap?** A static bootstrap handles "directory doesn't exist yet" but not "directory exists from an older CLI version and needs updates." Migrations handle both cases with the same mechanism. The overhead is minimal — it's just a version check and a loop — but it scales to any future `.taskless/` directory changes without ad-hoc upgrade logic.

**Alternative considered:** Static `ensureTasklessDirectory()` with version-based if/else blocks. Rejected because it doesn't compose well as the number of changes grows, and doesn't support safely removing old upgrade logic.

### 5. Skill routing: router + anonymous variant pattern

The existing `taskless-create-rule` and `taskless-improve-rule` skills become routers:

1. Run `taskless info --json`
2. Check `loggedIn` field
3. If true: proceed with existing API-backed flow (unchanged)
4. If false: delegate to the anonymous variant skill

Anonymous variants are separate SKILL.md files (`taskless-create-rule-anonymous`, `taskless-improve-rule-anonymous`) that:

- Do NOT have corresponding `/tskl:` commands — they're internal skills only
- Use `taskless rules verify --schema --json` to learn ast-grep syntax
- Guide the agent through: derive rule → write YAML + tests → `taskless rules verify <id> --json` → fix errors → repeat
- Write files directly to `.taskless/rules/` and `.taskless/rule-tests/` (no API, no metadata sidecar)

**Why separate files instead of conditional blocks?** The API flow and anonymous flow share almost no logic. Conditional blocks in a single SKILL.md would be long and harder for agents to follow reliably. Separate files keep each path focused.

**Alternative considered:** A single skill with a `mode` parameter. Rejected because skills don't have parameters — they're invoked by name, and the routing decision should be transparent to the user.

### 6. Anonymous rules produce no metadata sidecar

Rules created anonymously skip the `.taskless/rule-metadata/` sidecar entirely. There's no `ticketId` or `installationId` to record. The rule and test files are sufficient.

If a user later authenticates and wants to associate anonymous rules with the API, that's a separate future concern.

### 7. Test file naming follows existing convention

Anonymous rules use the same `<id>-<YYYYMMDD>-test.yml` naming convention as API-generated rules. This keeps `sg test` compatibility and allows `deleteRuleFiles()` to clean up consistently.

## Risks / Trade-offs

**Agent-derived rule quality may be lower than API-generated rules** — The API has specialized rule generation logic; agents working from a schema + examples may produce rules that are syntactically valid but semantically weak (e.g., overly broad patterns, missing edge cases).
→ Mitigation: The verify loop catches structural issues. The `--schema` examples should cover common patterns. Users can always iterate with `/tskl:improve`.

**ast-grep schema version drift** — If `@ast-grep/cli` is bumped but the codegen script isn't re-run, the embedded schema will be stale.
→ Mitigation: The codegen script should be part of the build pipeline. Document that schema must be regenerated when `@ast-grep/cli` version changes. Consider a CI check that compares the embedded schema version against `package.json`.

**`sg test` invocation may be slow or fail on some platforms** — The binary resolution logic in `scan.ts` handles this for `sg scan`, but `sg test` hasn't been used yet.
→ Mitigation: Reuse the existing `findSgBinary()` resolver for `sg test`. The same platform-specific binary supports both commands.

**Zod schema may not cover full ast-grep complexity** — The ast-grep schema has recursive `$ref` and `anyOf` patterns that may not convert cleanly to Zod.
→ Mitigation: The Zod schema validates the fields Taskless cares about (with `.passthrough()` for the rest). Layer 3 (`sg test`) catches any structural issues the Zod schema misses. The raw JSON Schema is still embedded for agent consumption via `--schema`.
