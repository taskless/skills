## Context

The repo currently distributes skills through a single channel: the `@taskless/cli` embeds skills from `plugins/taskless/skills/` at Vite build time and writes them to `.claude/skills/` via `taskless init`. This approach only supports Claude Code, requires manual version management, and uses a non-standard directory layout that isn't discoverable by the Vercel skills CLI or Claude Code Plugin Marketplace.

The CLI is at version `0.0.5` but the only existing skill (`info`) has `metadata.version: "0.0.2"` — demonstrating the drift problem. There are CLI commands for `auth login`, `auth logout`, `rules create`, and `rules delete` that have no corresponding skills.

The `install.ts` module handles skill embedding, tool detection, namespace prefixing, command derivation, AGENTS.md generation, and staleness checking — several of these responsibilities are being removed or simplified.

## Goals / Non-Goals

**Goals:**

- Skills discoverable via standard paths (`skills/`) for Vercel skills CLI and Claude Code marketplace
- One plugin (`taskless`) containing all skills and commands for marketplace distribution
- `taskless init` remains functional as a CLI-based installation route
- Skill `metadata.version` stays in sync with CLI version through automated tooling
- Build fails if versions drift (preventing stale skills from shipping)
- 4 new skills cover the remaining CLI commands (auth login/logout, rules create/delete)
- Commands (Claude Code only) are generated from skills and checked into the repo

**Non-Goals:**

- Expanding the `taskless init` tool registry beyond Claude Code (Vercel CLI handles multi-agent)
- CI/CD pipeline or GitHub Actions workflows
- Removing or replacing the `taskless init` command
- Publishing the marketplace to any external registry

## Decisions

### Decision 1: Skills live at `skills/` with `taskless-` prefixed names

Skills move from `plugins/taskless/skills/<name>/` to `skills/taskless-<name>/SKILL.md`. The prefix is part of the source name, not applied at install time.

**Rationale:** The `skills/` directory is a standard discovery path recognized by the Vercel skills CLI and multiple agents. Prefixing at source ensures the name is globally meaningful regardless of distribution channel. The current runtime-prefixing in `installForTool` created a split between source names and installed names that complicated reasoning.

**Alternatives considered:**

- Bare names with install-time prefix: Keeps current behavior but the marketplace and Vercel CLI would install `info` instead of `taskless-info`, which is too generic.
- Nested `skills/taskless/` directory: Non-standard discovery path.

### Decision 2: Commands are generated from skills, checked into the repo

A `scripts/generate-commands.ts` script reads `skills/taskless-*/SKILL.md`, strips the `taskless-` prefix, and writes `commands/taskless/<stripped-name>.md` with command frontmatter (`name: "Taskless: Title Case"`, `category: "Taskless"`, `tags: ["taskless"]`). The body is the skill body.

**Rationale:** Commands mirror skills but have different frontmatter. Generating them avoids manual sync. Checking them in means the marketplace can reference them directly without build steps. The CLI embeds them for `taskless init` placement.

**Alternatives considered:**

- Runtime derivation (current): Works for CLI but marketplace needs static files.
- Manually authored commands: Prone to drift from skills.

### Decision 3: Version sync via `changeset version` hook + build guard

The root `version` script chains: `changeset version && tsx scripts/sync-skill-versions.ts`. The sync script reads `packages/cli/package.json` version and updates all `SKILL.md` `metadata.version` values. The Vite build asserts that embedded skills' versions match the CLI version.

**Rationale:** Changeset version is the moment versions bump. Running sync immediately after ensures SKILL.md changes are part of the same version commit. The build guard catches any bypasses. This was chosen over a separate turbo task because the version commit needs the files updated before the commit is created.

**Alternatives considered:**

- Vite plugin replacing a placeholder: Clean but SKILL.md files on disk wouldn't show real versions.
- Standalone turbo pre-build task: Doesn't integrate with the changeset version commit.

### Decision 4: Single plugin for marketplace

The repo root is the plugin. `.claude-plugin/plugin.json` declares the plugin manifest. `.claude-plugin/marketplace.json` lists one plugin (`taskless`) with `source: "."`.

**Rationale:** All skills and commands belong to one product. Splitting into per-skill plugins adds overhead without benefit. The marketplace.json can declare `skills` and `commands` paths pointing to the repo root directories.

### Decision 5: Remove AGENTS.md generation

The `writeAgentsMd()` function, the no-tools fallback in `taskless init`, and the AGENTS.md staleness check are removed.

**Rationale:** AGENTS.md was a bootstrap mechanism before skills existed. With skills and the marketplace, it's redundant. The `taskless init` no-tools case should suggest marketplace or Vercel CLI installation instead.

### Decision 6: CLI embeds both skills and commands

The Vite config adds a second `import.meta.glob` for `commands/taskless/**/*.md`. `taskless init` detects whether the tool supports commands (Claude Code only) and places them at `.claude/commands/taskless/`.

**Rationale:** Commands are a Claude Code-only concept. Other agents get skills only (via Vercel CLI or direct copy). The tool registry already has a `commands` field for Claude Code — it stays, but now points to embedded command files instead of deriving them.

### Decision 7: tsx for build scripts

Add `tsx` as a root devDependency. Scripts in `scripts/` are TypeScript files run with `tsx scripts/<name>.ts`.

**Rationale:** The project already uses TypeScript everywhere. Plain `.mjs` would lose type safety. `tsx` is lightweight and well-established for running TS scripts. Two scripts are needed now (`sync-skill-versions`, `generate-commands`) with likely more in the future.

## Risks / Trade-offs

**[Existing `taskless init` users have stale files on disk]** → `taskless init` doesn't clean up old skill/command directories. Users who previously ran `taskless init` will have both old (`taskless-info` with version `0.0.2`) and new files. Mitigation: The staleness check will flag old versions. Documentation should note running `taskless init` again to update. A future cleanup step could remove orphaned skills.

**[Command generation could drift from skills]** → If someone modifies a skill and forgets to regenerate commands, the repo has inconsistent files checked in. Mitigation: A lint or CI check could verify `generate-commands` output matches checked-in files. Not implementing this now but straightforward to add.

**[Marketplace schema may evolve]** → The Claude Code plugin marketplace is relatively new. The `marketplace.json` format could change. Mitigation: Pin to the current schema. The file is small and easy to update.

**[Auth skills can't actually perform login]** → The auth login skill is informational — it tells the user the command to run. The device flow requires interactive terminal input (URL display, polling). An agent can't click links for the user. Trade-off: Accepted. The skill provides the command and explains the flow. A future improvement could have the skill run the command and surface the URL, but that requires the agent to execute a long-running blocking process.
