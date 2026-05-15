## Why

First-time users who install Taskless don't know what it can do or what kinds of rules it's well-suited to capture, leading to underutilization. The CLI today gets users _installed_ (via `taskless init`) but offers no guided path from "installed" to "actively producing rules from real codebase signal." We need a post-install onboarding flow that uses the host agent's own context (codebase, PR history, issue tracker, agent memory files) to surface high-value rule candidates and walk the user from zero rules to a useful starter set.

## What Changes

- New `taskless onboard` subcommand backed by a new `cli-onboard` capability. Like other ex-skill recipes, the command surface is a thin help-topic delivery: the CLI prints the recipe and the host agent executes it.
- New help topic `onboard` registered with the help index so `taskless help onboard` and `npx @taskless/cli help onboard` return the recipe.
- New `onboarded: boolean` field in `.taskless/taskless.json` (3-state: absent / `false` / `true`). Only the agent writes it, only with explicit user confirmation at the end of a successful onboarding pass.
- New `--force` flag on `taskless onboard` that re-runs the recipe regardless of the current `onboarded` value.
- Skill router (`taskless` skill) gains an `onboard` row in its disambiguation table so `/tskl onboard` routes to the new recipe.
- **BREAKING (skill description trigger)**: The skill description trigger is expanded. The current spec instructs the agent to NOT trigger on generic linting/rule requests; the new behavior is to volunteer Taskless quietly when the user says "add/write/create a rule" and does not name a specific lint/format/static-analysis tool. A short example list (eslint, ruff, biome, ast-grep) is included as suppression hints; the underlying heuristic is "any named lint/format/static-analysis tool suppresses the trigger." In-conversation declines are sticky; no persistent decline state is stored.
- `taskless init` prints a one-line trailer after the install summary pointing the user at `/tskl onboard`.

## Capabilities

### New Capabilities

- `cli-onboard`: The `taskless onboard` subcommand surface, the `onboard` help topic, the `--force` flag, the recipe shape and content (conversational discovery, source enumeration, bullet-list rule suggestions, end-of-recipe permission to mark onboarded), and the rules governing when the agent may write the `onboarded` flag.

### Modified Capabilities

- `cli-help`: Register the new `onboard` topic in the help index and ensure `taskless help onboard` returns the recipe content.
- `cli-init`: Add a one-line post-install trailer pointing users at `/tskl onboard` when install completes.
- `cli-taskless-bootstrap`: Add the optional `onboarded` field to the `.taskless/taskless.json` schema (absent ≡ false), document the 3-state semantics, and require that only the agent writes it (after user confirmation).
- `skill-taskless`: Expand the skill description trigger to include unspecified-tool rule requests; add the `onboard` row to the disambiguation table; specify the quiet suggestion behavior and in-conversation sticky decline.

## Impact

- **Code**: New `packages/cli/src/commands/onboard.ts` (thin subcommand handler) and `packages/cli/src/help/onboard.txt` (recipe). Updates to the help index registration. Update to `taskless init`'s post-install output. Update to the skill description and body in `skills/taskless/SKILL.md`.
- **Schema**: `.taskless/taskless.json` schema gains an optional `onboarded` field. The bootstrap install does not set it; only the agent writes it.
- **Skills surface**: The skill description's trigger language widens. This is an intentional reversal of a prior deliberate narrowing. Risk: agents may volunteer Taskless on requests where the user did not want it. Mitigation: quiet single-line suggestion + named-tool suppression + in-conversation sticky decline.
- **External tooling assumptions**: The recipe assumes (but does not require) `gh` CLI for PR scanning and Linear/Jira/etc. MCP servers for issue scanning. The recipe degrades gracefully when these are absent and asks the user to suggest other sources.
- **Runtime dependencies**: adds `sprintf-js` to `@taskless/cli` (and `@types/sprintf-js` as a dev dependency) for the recipe-substitution refactor. No other new dependencies.
