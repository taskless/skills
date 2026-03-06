## Why

The skills distribution model is limited to a single channel (`taskless init` for Claude Code only) with manual version management. The emerging agent skills ecosystem (Claude Code Plugin Marketplace, Vercel skills CLI) provides standardized discovery and multi-agent distribution, but our repo layout (`plugins/taskless/skills/`) is incompatible with standard discovery paths. Additionally, the CLI lacks skills for auth and rules commands, and skill `metadata.version` has already drifted from the CLI version (`0.0.2` vs `0.0.5`).

## What Changes

- **Move skills to standard discovery path**: Relocate from `plugins/taskless/skills/` to `skills/` at repo root. **BREAKING** — `import.meta.glob` path in Vite config changes; `plugins/` directory removed.
- **Prefix skill names at source**: Skill directories and frontmatter names include `taskless-` prefix (e.g., `taskless-info`, `taskless-auth-login`). `taskless init` installs verbatim without adding a prefix. **BREAKING** — changes install behavior for existing users.
- **Add 4 new skills**: `taskless-auth-login` (informational, shows CLI command), `taskless-auth-logout` (informational, shows CLI command), `taskless-rules-create` (conversational, gathers input, pipes JSON to CLI), `taskless-rules-delete` (conversational, identifies rule, runs CLI).
- **Add Claude Code Plugin Marketplace support**: Create `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` for a single `taskless` plugin containing all skills and commands.
- **Add checked-in commands**: Create `commands/taskless/` with command files that mirror skills. Generate via `scripts/generate-commands.ts` using tsx. Commands strip the `taskless-` prefix from filenames (e.g., `skills/taskless-auth-login/SKILL.md` → `commands/taskless/auth-login.md`).
- **Add version sync tooling**: Create `scripts/sync-skill-versions.ts` to update all `SKILL.md` `metadata.version` to match `packages/cli/package.json`. Runs as part of root `version` script after `changeset version`.
- **Add build-time version assertion**: Vite build fails if any embedded skill's `metadata.version` doesn't match the CLI version.
- **CLI embeds commands alongside skills**: `import.meta.glob` for `commands/taskless/**/*.md`. `taskless init` places commands into `.claude/commands/taskless/` (Claude Code only).
- **Remove AGENTS.md generation**: Drop `writeAgentsMd()`, the no-tools fallback, and AGENTS.md staleness checks.
- **Remove `release` script from CLI package.json**: Build and publish orchestrated from root via turbo.
- **Add `tsx` as root devDependency** for build scripts.

## Capabilities

### New Capabilities

- `skills-distribution`: Defines the repo layout for skills and commands, the marketplace manifest, and the multi-channel distribution model (taskless init, plugin marketplace, Vercel skills CLI).
- `build-tooling`: Defines the version sync script, command generation script, build-time version guard, and the root-level release pipeline via turbo.
- `skill-auth-login`: Defines the `taskless-auth-login` skill behavior (informational, shows device flow CLI command).
- `skill-auth-logout`: Defines the `taskless-auth-logout` skill behavior (informational, shows logout CLI command).
- `skill-rules-create`: Defines the `taskless-rules-create` skill behavior (conversational, gathers prompt/language/examples, pipes JSON to CLI, may analyze codebase).
- `skill-rules-delete`: Defines the `taskless-rules-delete` skill behavior (conversational, lists rules, confirms identity, runs CLI delete).

### Modified Capabilities

- `skills`: Skill naming convention changes from bare names to `taskless-` prefixed names. Directory structure changes from `plugins/taskless/skills/` to `skills/`. Version field sourced from CLI package.json.
- `cli`: Remove `release` script. Vite glob paths change. CLI embeds commands in addition to skills. `taskless init` installs skills and commands verbatim (no prefix logic). AGENTS.md generation removed. Build-time version assertion added.
- `cli-init`: Init behavior changes — no prefix added, commands placed alongside skills, AGENTS.md no longer written. Tool registry `commands` field updated for Claude Code.

## Impact

- **Repo structure**: `plugins/` directory removed. `skills/`, `commands/taskless/`, `scripts/`, `.claude-plugin/` directories created.
- **packages/cli**: `src/actions/install.ts` significantly refactored (remove AGENTS.md, prefix logic, derivation; add command embedding/placement). `vite.config.ts` updated (glob paths, version assertion). `package.json` loses `release` script.
- **Root package.json**: New scripts (`version`, `generate-commands`). New devDependency (`tsx`).
- **turbo.json**: Pipeline may need adjustment for build sequencing.
- **Existing users of `taskless init`**: Skills get reinstalled with new names. Old `taskless-info` skill/command persists on disk (not cleaned up automatically).
