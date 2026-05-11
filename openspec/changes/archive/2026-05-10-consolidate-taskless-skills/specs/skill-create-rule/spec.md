# Skill: Rules Create

## REMOVED Requirements

### Requirement: Rules create skill gathers input conversationally

**Reason**: The standalone `taskless-create-rule` skill is replaced by the consolidated `taskless` skill plus the `tskl help rule create` recipe.

**Migration**: The conversational input-gathering instructions move into `packages/cli/src/help/rule-create.txt` (API-backed flow) and `packages/cli/src/help/rule-create.anonymous.txt` (local-only flow). Agents discover these via the consolidated `taskless` skill's topic table.

### Requirement: Rules create skill invokes CLI with JSON stdin

**Reason**: Same as above. Recipe steps now live in the help text files, not in a per-skill SKILL.md.

**Migration**: The CLI invocation `npx @taskless/cli rule create --from <file> --json` (note the verb rename `rules` → `rule`) is documented in `rule-create.txt`. The flag set and JSON input shape are unchanged.

### Requirement: Rules create skill constructs valid JSON payload

**Reason**: Same as above.

**Migration**: The JSON payload shape is documented in the embedded JSON schema (zod-to-json-schema output) within `rule-create.txt` per the new recipe template requirement in `cli-help`.

### Requirement: Rules create skill handles stale config errors

**Reason**: Same as above.

**Migration**: Error handling moves to the recipe's `## Errors` section, which references stable error codes emitted by the CLI's `--json` failure mode (per `cli` capability standardization).

### Requirement: Rules create skill has correct frontmatter

**Reason**: There is no longer a `taskless-create-rule` skill file with frontmatter — the file itself is removed.

**Migration**: The consolidated `taskless` skill's frontmatter is governed by `skill-taskless` capability requirements.

### Requirement: Rules create skill routes by authentication status

**Reason**: Auth-state branching no longer routes between two skills; it is handled inside the recipe via `--anonymous` variant lookup.

**Migration**: When the user is logged out OR the agent is told to use anonymous mode, it fetches `tskl help rule create --anonymous`, which returns the local-only recipe. The `--anonymous` flag is also passed to the CLI invocation, where it dispatches the local-only flow per the `cli` capability requirements.

### Requirement: Anonymous create skill derives rules locally via agent

**Reason**: The `taskless-create-rule-anonymous` skill is removed; the local-only flow moves into the CLI's `rule create --anonymous` branch and the `rule-create.anonymous.txt` recipe.

**Migration**: See `cli-rules` for the `--anonymous` branch behavior; see `cli-help` for the recipe variant lookup.

### Requirement: Anonymous create skill writes rule and test files

**Reason**: Same as above. File writes now happen in the CLI, not orchestrated by the agent.

**Migration**: The CLI's `rule create --anonymous` branch SHALL write `.taskless/rules/<id>.yml` and `.taskless/rule-tests/<id>.yml` directly. The recipe's Steps section reflects this — the agent invokes and reports.

### Requirement: Anonymous create skill uses verify feedback loop

**Reason**: The verify loop remains in the recipe; the agent still owns the iteration. Only the skill file is removed.

**Migration**: The `rule-create.anonymous.txt` recipe documents the verify loop step-by-step, invoking `npx @taskless/cli rule verify` (note rename) between agent edits.

### Requirement: Anonymous create skill produces no metadata sidecar

**Reason**: This behavior remains true of the `--anonymous` branch but is governed by the CLI command's behavior, not the skill.

**Migration**: Documented in `rule-create.anonymous.txt` and enforced by the CLI `rule create --anonymous` implementation.

### Requirement: Anonymous create skill is not directly invocable

**Reason**: There is no anonymous skill to be invocable in the new design.

**Migration**: Anonymous mode is reached by passing `--anonymous` to any compatible action; there is no separate skill the user or agent can invoke directly.

### Requirement: Anonymous create skill has correct frontmatter

**Reason**: There is no longer a `taskless-create-rule-anonymous` skill file with frontmatter.

**Migration**: N/A.
