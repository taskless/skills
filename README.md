# Taskless Skills

A skills repository for agentic workflows, built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other Agent capable systems.

Includes a CLI that works with agentic systems (and humans too) at @taskless/cli.

## Structure

```
skills/
  taskless/SKILL.md                # Single consolidated router skill
commands/
  tskl/tskl.md                     # Single /tskl router command
packages/
  cli/                             # @taskless/cli — recipes live in cli/src/help/
scripts/
  generate-commands.ts             # Generates commands from skills
  link-skills.ts                   # Symlinks skills into .claude/skills/
  sync-skill-versions.ts           # Syncs metadata.version to CLI version
.claude-plugin/                    # Claude Code Plugin Marketplace manifest
```

## Skill

Starting in v0.7, Taskless ships a **single consolidated skill** (`taskless`) plus a single `/tskl` slash command. The skill body is a small router; per-task instructions live behind `npx @taskless/cli help <topic>` and are fetched on demand.

| Skill      | Command       | Description                                            |
| ---------- | ------------- | ------------------------------------------------------ |
| `taskless` | `/tskl <ask>` | Router for any Taskless action (create rule, improve,  |
|            |               | delete, check, auth, CI). Fetches the canonical recipe |
|            |               | for the user's intent and follows it.                  |

Available `taskless help` topics: `rule create`, `rule improve`, `rule delete`, `check`, `auth`, `ci`, `info`, `init`. Append `--anonymous` for the local-only flow on rule create/improve.

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

### Adding a new topic recipe

In v0.7+, new agent-facing instructions are added as **recipes**, not skills. To add a recipe:

1. Create `packages/cli/src/help/<topic>.txt` following the canonical template (Goal / Preconditions / Steps / Input schema / Errors / See Also).
2. Use `{{CLI_VERSION}}` and `{{INPUT_SCHEMA}}` placeholders for runtime interpolation.
3. For topics with a substantively different local-only flow, add `<topic>.anonymous.txt`. The help command's variant lookup is automatic.
4. Update the topic table in `skills/taskless/SKILL.md` and `commands/tskl/tskl.md` so agents can discover the new topic.

### Distribution channels

- **`taskless init`** — CLI installs the consolidated skill to `.claude/skills/taskless/` and the command to `.claude/commands/tskl/`
- **Claude Code Plugin Marketplace** — `.claude-plugin/marketplace.json` and `plugin.json`
- **Vercel Skills CLI** — `npx skills add` discovers skills from `skills/` directory
