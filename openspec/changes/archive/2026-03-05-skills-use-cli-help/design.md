## Context

Agent skills (SKILL.md files in `skills/`) currently contain hardcoded CLI usage documentation — option lists, output format descriptions, example commands, and step-by-step invocation instructions. This content duplicates what the CLI already knows. The `cli-help-subcommand` change adds `taskless help <command>`, which provides authoritative, always-current documentation embedded at build time.

Skills are consumed by coding agents (Claude Code, etc.) that execute CLI commands on behalf of users. The agents read the SKILL.md instructions and follow them. Today, if the CLI changes an option or output format, every affected skill must be manually updated.

## Goals / Non-Goals

**Goals:**

- Skills delegate to `taskless help <command>` as the first step for understanding a command's usage, options, and examples
- Skills that invoke CLI commands with JSON support (`check`, `info`, `rules create`) prefer `--json` for machine-readable output
- Skills use examples from help output to construct their invocations
- Skill files become shorter and focused on agent-specific workflow (what to do) rather than CLI documentation (how the CLI works)

**Non-Goals:**

- Changing the CLI help text files themselves (those are defined by `cli-help-subcommand`)
- Changing the CLI's behavior or output formats
- Adding new skills or removing existing ones
- Changing the SKILL.md frontmatter format or metadata

## Decisions

### Skills invoke `taskless help` to read command documentation

Each skill's instructions begin with a step that runs `taskless help <command>` (using the appropriate package manager runner) and reads the output. The agent uses this output to understand the command's usage, options, and examples before executing the actual command.

**Why not just reference help text inline?** The help text is embedded in the CLI at build time. If we copied it into SKILL.md, we'd be back to duplicating documentation. Having the agent read help at runtime ensures it always gets current information, even if the installed CLI version differs from when the skill was written.

**Alternative considered:** Embedding the help text directly in the skill markdown. Rejected because it defeats the purpose — we'd still need to update skills when help changes.

### Each skill retains its agent-specific workflow

Skills still contain instructions that are specific to agent behavior — things the CLI help doesn't cover:

- **taskless-login / taskless-logout**: "Do NOT attempt to run this command" — these require interactive terminal input
- **taskless-rule-create**: Gathering user input for the JSON payload, inferring language from codebase
- **taskless-rule-delete**: Listing rules, confirming with user before deletion
- **taskless-check**: Interpreting results and reporting to user
- **taskless-info**: Interpreting JSON fields, detecting upgrade needs

The help output provides _what the command does_; the skill provides _what the agent should do with it_.

### Skills prefer `--json` where available

Commands that support `--json` (`check`, `rules create`) should use it by default in skill instructions. The `info` command always outputs JSON (no flag needed). This makes output parsing reliable for agents.

### Package manager detection is simplified

Skills prefer `pnpm dlx` if available, otherwise fall back to `npx`. This is a soft preference, not a formal detection step — the CLI works identically either way. Skills should not make package manager detection a prominent part of their instructions.

## Risks / Trade-offs

- **Agent must run an extra command** → Each skill invocation now runs `taskless help <command>` before the actual command. This adds a small latency cost but ensures documentation is always current. The help output is served from the embedded bundle, so it's fast.
- **Help output format could change** → Skills reference the help output loosely ("read the usage, options, and examples") rather than parsing specific lines. This is resilient to formatting changes.
- **Dependency on `cli-help-subcommand` being complete** → This change assumes `taskless help` is available. If it's not, the help step will fail and agents will not have usage documentation. The skills should include a graceful fallback note.
