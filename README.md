# Taskless Skills

A skills repository for agentic workflows, built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other Agent capable systems.

Includes a CLI that works with agentic systems (and humans too) at @taskless/cli.

## Structure

```
plugins/
  taskless/                  # Taskless skills plugin
    skills/
      info/SKILL.md          # /taskless:info — confirms Taskless is working
packages/
  cli/                       # @taskless/cli — Taskless CLI
```

## Skills

Skills follow the [Agent Skills Specification](https://agentskills.io) with additional hooks for Claude Code integration.

| Skill | Command          | Description                                |
| ----- | ---------------- | ------------------------------------------ |
| info  | `/taskless:info` | Confirms Taskless is installed and working |

## CLI

The `@taskless/cli` package provides a CLI agent for Taskless workflows. It's recommended to always call the `latest` tag unless you know you need a specific version:

```bash
pnpm dlx @taskless/cli@latest info
npx @taskless/cli@latest info
```
