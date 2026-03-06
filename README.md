# Taskless Skills

A skills repository for agentic workflows, built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other Agent capable systems.

Includes a CLI that works with agentic systems (and humans too) at @taskless/cli.

## Structure

```
skills/
  taskless-info/SKILL.md           # Confirms Taskless is working
  taskless-login/SKILL.md          # Explains auth login
  taskless-logout/SKILL.md         # Explains auth logout
  taskless-rule-create/SKILL.md    # Creates a Taskless rule
  taskless-rule-delete/SKILL.md    # Deletes a Taskless rule
commands/
  taskless/                        # Generated commands (do not edit)
packages/
  cli/                             # @taskless/cli
scripts/
  generate-commands.ts             # Generates commands from skills
  link-skills.ts                   # Symlinks skills into .claude/skills/
  sync-skill-versions.ts           # Syncs metadata.version to CLI version
.claude-plugin/                    # Claude Code Plugin Marketplace manifest
```

## Skills

Skills follow the [Agent Skills Specification](https://agentskills.io) with additional hooks for Claude Code integration.

| Skill                | Command            | Description                                |
| -------------------- | ------------------ | ------------------------------------------ |
| taskless-info        | `/taskless:info`   | Confirms Taskless is installed and working |
| taskless-login       | `/taskless:login`  | Explains how to authenticate               |
| taskless-logout      | `/taskless:logout` | Explains how to remove credentials         |
| taskless-rule-create | `/taskless:rule`   | Creates a new Taskless rule                |
| taskless-rule-delete | —                  | Deletes a Taskless rule                    |

## CLI

The `@taskless/cli` package provides a CLI agent for Taskless workflows. It's recommended to always call the `latest` tag unless you know you need a specific version:

```bash
pnpm dlx @taskless/cli@latest info
npx @taskless/cli@latest info
```

## Releasing

Releases use [Changesets](https://github.com/changesets/changesets) with Turborepo for orchestration.

### Build graph

`pnpm build` runs the following steps sequentially via `run-s`:

1. **build:generate-commands** — reads `skills/taskless-*/SKILL.md`, generates `commands/taskless/*.md` from each skill's `metadata.commandName` field. Skills with `commandName: "-"` are skipped.
2. **build:link-skills** — symlinks `skills/` into `.claude/skills/` and `commands/` into `.claude/commands/` for local development.
3. **build:compile** — Turborepo runs `vite build` in `packages/cli`, embedding all skills and commands at build time via `import.meta.glob`. A build-time plugin asserts that every skill's `metadata.version` matches the CLI package version.

### Version workflow

```bash
pnpm changeset          # Create a changeset describing the change
pnpm bump               # Bump versions and sync skill metadata
pnpm build              # Build with version assertion
```

`pnpm bump` runs `changeset version` to bump `packages/cli/package.json`, then runs `sync-skill-versions` to update `metadata.version` in all `skills/*/SKILL.md` files to match.

`pnpm package` combines both steps (`bump` then `build`) for convenience.

### Adding a new skill

1. Create `skills/taskless-<name>/SKILL.md` with frontmatter including `metadata.commandName`
2. Set `commandName` to `"taskless:<command>"` for a slash command, or `"-"` for no command
3. Run `pnpm build` — commands are generated automatically and embedded into the CLI

### Distribution channels

- **`taskless init`** — CLI installs skills to `.claude/skills/` and commands to `.claude/commands/taskless/`
- **Claude Code Plugin Marketplace** — `.claude-plugin/marketplace.json` and `plugin.json`
- **Vercel Skills CLI** — `npx skills add` discovers skills from `skills/` directory
