# Taskless Skills

A skills repository for agentic workflows, built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## Structure

```
plugins/
  taskless/                  # Taskless skills plugin
    skills/
      info/SKILL.md          # /taskless:info — confirms Taskless is working
packages/
  cli/                       # @taskless/cli — Taskless CLI agent
```

## Skills

Skills follow the [Claude Code plugin format](https://github.com/getsentry/skills) with YAML frontmatter in `SKILL.md` files.

| Skill | Command | Description |
|-------|---------|-------------|
| info | `/taskless:info` | Confirms Taskless is installed and working |

## CLI

The `@taskless/cli` package provides a CLI agent for Taskless workflows.

```bash
pnpm dlx @taskless/cli
npx @taskless/cli
```

## Development

```bash
pnpm install                          # Install dependencies
pnpm lint                             # Run ESLint
pnpm lint:fix                         # Run ESLint with auto-fix
pnpm --filter @taskless/cli build     # Build the CLI
pnpm --filter @taskless/cli typecheck # Type check the CLI
```
