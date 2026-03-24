# @taskless/cli

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
