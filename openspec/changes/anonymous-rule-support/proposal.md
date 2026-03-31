## Why

With Taskless v0.4.0, authentication is no longer required for core functionality. However, rule creation and improvement still hard-require auth because they rely on the Taskless API for rule generation. Users who haven't authenticated (or don't want to) are locked out of the entire rule workflow. Adding an anonymous path — where the local agent derives rules directly — makes rule creation universally accessible while keeping the API-backed flow as a premium option for authenticated users.

## What Changes

- **New `rules verify` subcommand**: Validates rule YAML against the official ast-grep schema with Taskless-specific requirements layered on top, checks completeness, and runs rules against their test cases via `sg test`. A `--schema` flag dumps the combined schema with annotated examples for agent consumption.
- **Codegen for ast-grep schema**: Fetch the official ast-grep `rule.json` schema from GitHub at build time (pinned to the `@ast-grep/cli` version), storing it as a generated artifact alongside the existing OpenAPI types.
- **Anonymous skill variants**: New `taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous` skills that use the local agent to derive ast-grep rules without API calls, using a generate-verify-fix loop powered by `rules verify`.
- **Skill routing by auth status**: The existing `taskless-create-rule` and `taskless-improve-rule` skills become routers — they call `taskless info --json` to check auth, then delegate to either the API-backed flow (authenticated) or the anonymous variant (unauthenticated).
- **Lazy `.taskless/` bootstrap**: Any CLI command that writes to `.taskless/` will first ensure the directory exists with a `README.md`, `.gitignore` (excluding `.env.local.json` and `sgconfig.yml`), `taskless.json` version manifest, and empty `rules/` and `rule-tests/` directories.

## Capabilities

### New Capabilities

- `cli-taskless-bootstrap`: Lazy initialization of the `.taskless/` directory with README, gitignore, version manifest, and directory structure on first write.

### Modified Capabilities

- `cli-rules`: Adds build-time codegen to fetch the official ast-grep rule JSON schema from GitHub (pinned to the installed `@ast-grep/cli` version), and a new `rules verify` subcommand — Zod schema validation, Taskless requirement checks (e.g. regex requires kind), test execution via `sg test`, and `--schema` output for agent consumption.
- `skill-create-rule`: Adds auth-check routing (delegates to anonymous flow when unauthenticated) and anonymous rule creation — agent-driven rule derivation using `rules verify --schema` for syntax guidance and `rules verify <id>` as a validation feedback loop.
- `skill-improve-rule`: Adds auth-check routing and anonymous rule improvement — same agent-driven pattern applied to iterating on existing rules.
- `cli-init`: Installs the new anonymous skill variants alongside existing skills (no behavior change to init itself, just more skills in the bundle).

## Impact

- **CLI (`packages/cli/`)**: New `rules verify` subcommand, new codegen script, new bootstrap action, modified `rules create`/`rules improve` commands (no breaking changes — they still work identically for authenticated users).
- **Skills (`skills/`)**: Two new anonymous skill directories (`taskless-create-rule-anonymous`, `taskless-improve-rule-anonymous`), two modified router skills. No new `/tskl:` commands — anonymous skills are internal-only.
- **Build tooling**: New codegen step to fetch and commit the ast-grep schema. Must run when `@ast-grep/cli` version is bumped.
- **Dependencies**: Zod schema derived from the official ast-grep JSON Schema at codegen time. No new validation library needed — the CLI already uses Zod.
- **`.taskless/` directory**: New files created on bootstrap (README.md, .gitignore, taskless.json). Existing repos will get these on next CLI write operation.
