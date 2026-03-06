# @taskless/cli

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
