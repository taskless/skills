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

## Releasing taskless/skills

Releases use [Changesets](https://github.com/changesets/changesets) with Turborepo for orchestration.

### Release process

Start from a clean repo (no uncommitted changes), then:

```bash
pnpm bump               # Bump versions and sync skill metadata
pnpm build              # Build CLI and generate commands
pnpm test               # Run all tests, confirm no errors
git add -A              # Stage all changes
git commit -m "chore: Releases vx.y.z"  # Commit with new version number
pnpm release            # Dry run — prints publish command when ready
```

### Adding a new skill

1. Create `skills/taskless-<name>/SKILL.md` with frontmatter including `metadata.commandName`
2. Set `commandName` to `"taskless:<command>"` for a slash command, or `"-"` for no command
3. Run `pnpm build` — commands are generated automatically and embedded into the CLI

### Distribution channels

- **`taskless init`** — CLI installs skills to `.claude/skills/` and commands to `.claude/commands/taskless/`
- **Claude Code Plugin Marketplace** — `.claude-plugin/marketplace.json` and `plugin.json`
- **Vercel Skills CLI** — `npx skills add` discovers skills from `skills/` directory
