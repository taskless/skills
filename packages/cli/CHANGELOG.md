# @taskless/cli

## 0.6.0

### Minor Changes

- 64f2c4f: Add interactive `init` wizard. Running `taskless` in a terminal (or `taskless init`) now launches a `@clack/prompts` wizard that lets you pick install locations, choose optional skills (currently `taskless-ci`), and walks through the auth tradeoff before writing anything.

  **Breaking:** bare `taskless` (no subcommand) now delegates to `init` when stdout is a TTY. Non-TTY invocations still print top-level help. For scripted installs, pass `--no-interactive` to `taskless init` to preserve the previous behavior (install mandatory skills to every detected tool location, no prompts).

  Also adds:
  - `install` field in `.taskless/taskless.json` (migration 2) tracking per-target skills and commands, used by the wizard to compute a diff and surgically remove files on re-run
  - `taskless-ci` skill in the bundle as an optional opt-in, with agent-facing instructions that cover CI discovery, full-scan/diff-scan patterns, and non-destructive config generation for any CI system the agent recognizes
  - `taskless check <paths...>` for diff-only scanning in CI (silently filters missing paths so `git diff` output can be piped in directly)
  - `cliVersion` and `scaffoldVersion` attached to every PostHog telemetry event, for deprecation tracking

## 0.5.4

### Patch Changes

- 60f8dba: Show auth status when running `taskless auth` without a subcommand, with a hint to run `auth login` if not authenticated.

## 0.5.3

### Patch Changes

- cf813da: Add multi-tool detection for `taskless init`. The CLI now detects and installs skills for OpenCode (`.opencode/`, `opencode.jsonc`, `opencode.json`), Cursor (`.cursor/`, `.cursorrules`), and Claude Code (now also via `CLAUDE.md`). When no tools are detected, skills are installed to `.agents/skills/` as a fallback.

## 0.5.2

### Patch Changes

- 64b836f: Add explicit `commandName: "-"` to anonymous skill frontmatter

  The anonymous skills (`taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous`) were missing the `metadata.commandName` field. Added `commandName: "-"` for consistency with all other skills that don't expose a slash command.

- a4c78fb: Fix "auth login" to use the correct CLI command

  Replaced bare `taskless auth login` references with the proper `npx @taskless/cli@latest auth login` invocation in skills, generated commands, CLI error messages, and rules help text. CLI error messages now dynamically detect the invoking package manager via `npm_config_user_agent`. Skills default to `npx` with a note to prefer the project's package manager.

- 321d285: Fix crash during init when `.taskless/taskless.json` contains corrupt or unparseable JSON. The CLI now treats a corrupt manifest the same as a missing one, allowing migrations to re-run and rewrite it.

  Add `module` and `exports` fields to package.json to ensure ESM resolution works correctly on older Node versions or when package.json resolution is incomplete.

## 0.5.1

### Patch Changes

- 57ccac7: Add anonymous telemetry via PostHog to track CLI command usage

## 0.5.0

### Minor Changes

- 75f3b80: Remove global XDG auth token storage (`~/.config/taskless/auth.json`) in favor of per-repo tokens only. Authentication is now scoped to each repository via `.taskless/.env.local.json`. A deprecation notice is shown when a legacy global token file is detected. The device flow now sends a repository URL hint to the auth server.
- 75f3b80: Reorganize CLI internals into domain directories (`auth/`, `api/`, `rules/`, `filesystem/`, `install/`, `util/`), add a migration-based `.taskless/` bootstrap system, and upgrade from Zod 3 to Zod 4. The filesystem layer introduces numbered migrations with idempotent re-runs, version tracking in `taskless.json`, and automatic v0-to-v1 migration for existing installations. Zod 4 enables native `z.fromJSONSchema()` and `z.toJSONSchema()`, replacing the `zod-to-json-schema` dependency.

### Patch Changes

- 75f3b80: Add anonymous rule creation and improvement skills that work without API authentication. The existing `/tskl:rule` and `/tskl:improve` commands now check auth status via `taskless info --json` and transparently delegate to anonymous variants when not logged in. Anonymous skills use the `rules verify` feedback loop to iteratively validate agent-generated rules against the ast-grep schema.
- 75f3b80: Add `rules verify` command with three-layer validation: Layer 1 validates rule YAML against the official ast-grep JSON schema (fetched at build time via codegen), Layer 2 checks Taskless-specific requirements (required fields, regex-requires-kind, test file existence), and Layer 3 runs `sg test` for the specified rule. Includes `--schema --json` mode that outputs the ast-grep schema, Taskless requirements, and curated examples for agent consumption.
- 75f3b80: Harden CLI security: remove `shell: true` from `spawn` calls to eliminate shell injection surface, add rule ID validation (`/^[a-z0-9][a-z0-9-]*$/`) to prevent path traversal in file operations, escape regex metacharacters in `sg test --filter` arguments, and replace fragile string-based error parsing with structured return types.

## 0.4.0

### Minor Changes

- Remove scaffold dependency from CLI. Identity is now resolved from JWT (`orgId`) and git remote (`repositoryUrl`) instead of `taskless.json`. Add per-repo token storage in `.taskless/.env.local.json`, ephemeral `sgconfig.yml` generation for check command, and fetch OpenAPI schema from live URL.

### Patch Changes

- 48991e6: Fix CLI auth to check token expiry instead of just token existence, preventing commands from reporting a logged-in state with an expired JWT
- 7397516: Write sidecar metadata files from generator API response to `.taskless/rule-metadata/`, fixing metadata not being persisted during rule create and improve flows
- 7397516: Add `rules meta` CLI subcommand to read sidecar metadata for a rule. Update create-rule skill to check for similar existing rules before creating, and improve-rule skill to use `ticketId` from metadata for the iterate API. Fix test directory references and skill-to-skill handoff in both skills.

## 0.3.0

### Minor Changes

- 771a13b: Add `--schema` flag to CLI commands with `--json` support. When passed, prints Input Schema, Output Schema, and Error Schema as JSON Schema objects and exits. Introduces Zod as the single source of truth for CLI I/O validation and schema generation.

## 0.2.1

### Patch Changes

- 230091e: Fix `init` to clean up stale skills and commands from previous naming conventions before installing. Removes all `taskless-*` and `use-taskless-*` skill directories and both `taskless/` and `tskl/` command directories, then installs a fresh set. Also fixes the embedded command glob and tool registry to use the current `tskl` path.

## 0.2.0

### Minor Changes

- ecf338d: Add `rules improve` CLI subcommand and `taskless-improve-rule` skill for iterating on existing rules via the new `/cli/api/rule/{ruleId}/iterate` endpoint. The skill guides agents through a decision tree: iterate on a single rule, replace it entirely, or expand into multiple rules. Also updates `rules create` to accept `successCases`/`failureCases` as arrays (matching the updated API schema).
- ecf338d: Rename skills from `use-taskless-*` to `taskless-*` and commands from `taskless:*` to `tskl:*`. Skill directories now follow the `taskless-<verb>-<noun>` convention (e.g., `taskless-create-rule`, `taskless-improve-rule`). Cross-references in skill instructions now use skill names instead of command names for compatibility with non-command agentic systems.
- ecf338d: Replace hand-written fetch calls with a typed API client powered by `openapi-fetch` and `openapi-typescript`. Request and response types are now generated from the OpenAPI schema at `.generated/schema.json`, removing manual type definitions for API interactions. Rule file types (`GeneratedRule`, etc.) are now derived from the schema.

## 0.1.5

### Patch Changes

- 87d5644: Fixes command in info skill

## 0.1.4

### Patch Changes

- f9d7ac6: Updates skills to collect additional information

## 0.1.3

### Patch Changes

- 914dc37: Fix ast-grep binary not found when CLI installed via pnpm dlx. The strict dependency isolation prevents @ast-grep/cli's postinstall from resolving platform-specific binary packages, leaving a placeholder text file instead of the real binary. Now resolves the platform binary directly from our own module context.

## 0.1.2

### Patch Changes

- fe18d42: Fix `rules create` requiring scaffold version 2026-03-03 which doesn't exist yet, causing users on the latest scaffold (2026-03-02) to be told to update when they're already current

## 0.1.1

### Patch Changes

- 5e0864a: Use default API URL for rule and update-engine providers instead of requiring env var

## 0.1.0

### Minor Changes

- 00320f6: Replace stdin JSON input with --from file flag for rules create

### Patch Changes

- 00320f6: Add update-engine command for requesting scaffold upgrades
- 00320f6: Replace version compatibility ranges with per-subcommand minimum scaffold versions

## 0.0.7

### Patch Changes

- 1f96316: chore: Modernize build tooling and version syncing
  - Replaced link-skills.sh with TypeScript for consistency across all build scripts
  - Refactored package.json scripts to use npm-run-all2 (run-s) for cross-platform sequential execution, removing all && chains
  - Simplified turbo.json by removing root tasks in favor of explicit run-s orchestration via namespaced sub-scripts (build:_, bump:_)
  - Fixed link-skills to also symlink commands/ into .claude/commands/ (was a broken symlink)
  - Version syncing (bump:sync) now also updates .claude-plugin/plugin.json and root package.json to stay in sync with CLI version
  - Disabled unicorn/no-null eslint rule globally, removing inline overrides

## 0.0.6

### Patch Changes

- 872d378: Add `taskless help <command>` subcommand with rich help text for all commands. Help files are plain .txt embedded at build time via import.meta.glob. Supports nested commands (e.g., `taskless help auth login`).
- 382ddfa: Fix YAML frontmatter line wrapping that broke skill installation. The `yaml` library's default 80-character line width was folding long strings (like `description`) across multiple lines, which broke frontmatter parsers expecting single-line values. Disabled line wrapping with `lineWidth: 0` for all YAML serialization (frontmatter, rule files, and test files).
- 9734356: Restructure skills distribution and CLI commands. Move skills from plugins/ to skills/ at repo root. Add multi-channel distribution (CLI init, Claude Code Plugin Marketplace, Vercel skills CLI). Add generate-commands and sync-skill-versions scripts. Restructure CLI with auth and rules subcommand groups, check command with JSON output, and init with org/repo config.
- cd4a671: Skills now invoke `taskless help <command>` as their first step instead of hardcoding CLI documentation. Commands with JSON support (check, rules create) use --json flag. Add link-skills to build graph.

## 0.0.4

### Patch Changes

- Add `taskless rules create` and `taskless rules delete` commands for generating and managing ast-grep rules via the taskless.io API. Includes whoami integration for `taskless info`, a new minimum spec version (2026-03-03) requiring `orgId` and `repositoryUrl` in project config, and executable permissions on the built CLI output.

## 0.0.3

### Patch Changes

- Add check command with ast-grep scanning, version compatibility, and formatting support
- 82ad614: Add init/update command with skill installation and staleness detection

## 0.0.2

### Patch Changes

- Add `taskless info` subcommand that outputs CLI version as JSON. Replace stub entry point with citty-based subcommand structure. Version is injected at build time via Vite define.
