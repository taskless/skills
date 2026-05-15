## Context

Today's CLI gets users _installed_ through `taskless init` (a fast, deterministic wizard) and exposes per-task agent flows via the consolidated `taskless` skill, which routes the host agent to recipes fetched on demand from `npx @taskless/cli help <topic>`. There is no path between "installed" and "actively producing rules from real codebase signal" — first-time users typically don't know what kinds of rules Taskless is well-suited to capture, what sources to mine for candidates, or how to prioritize them.

Onboarding is intrinsically agent work: it requires reading the codebase, parsing AGENTS.md/CLAUDE.md/.cursorrules style documents, optionally probing GitHub PR comments via `gh`, optionally querying a Linear/Jira MCP, and synthesizing a prioritized list of _hypothetical_ rules that the user can choose to materialize. The CLI cannot do any of that itself — it has no LLM. So `onboard` follows the same shape as the other ex-skill recipes: a thin CLI surface that gates on state and delivers a recipe the host agent executes.

The change also reverses a deliberate prior decision: the current `skill-taskless` description explicitly tells the agent _not_ to trigger on generic linting or rule requests. The new design widens the trigger to volunteer Taskless quietly when the user wants to add a rule and has not named another tool. This is intentional but it carries a real reputation cost if it manifests as advertising rather than helpfulness, so the design is opinionated about _how_ the volunteering shows up.

## Goals / Non-Goals

**Goals:**

- Provide a `taskless onboard` subcommand with a help topic that delivers a conversational, agent-executed recipe for first-pass rule discovery.
- Track onboarding state in `.taskless/taskless.json` via an `onboarded` field that the agent writes only after explicit user confirmation.
- Expand the `taskless` skill so it volunteers Taskless on rule requests where no other tool is named.
- Degrade gracefully when external tools (`gh`, MCPs) are absent — onboarding must produce value with only codebase + agent-memory files.
- Keep the always-loaded skill surface small (description + body together stay within the existing constraints).

**Non-Goals:**

- This change does NOT introduce automated rule generation. The recipe surfaces _suggestions_ as bullet points; the user (with the agent's help) chooses which to materialize via the existing `/tskl create rule` flow.
- This change does NOT add any persistent decline state. A user who declines the proactive suggestion in a conversation is not remembered across conversations.
- This change does NOT modify any existing recipe content (check, rule create/improve/delete, auth, ci, init). Those topics are unchanged.
- This change does NOT introduce a separate slash command. Routing is via the existing `/tskl` consolidated command + the new `onboard` topic in the skill router.
- This change does NOT enumerate every linter on earth in the trigger description; the description uses spirit-of-the-rule wording with four anchor examples.

## Decisions

### Decision 1: Recipe lives in `help/onboard.txt`; CLI surface is a thin gate

`taskless onboard` is implemented as a small subcommand handler that:

1. Reads `.taskless/taskless.json` (bootstrapping the directory if absent).
2. If `onboarded === true` and `--force` is not set, prints "Already onboarded; pass --force to redo" and exits 0.
3. Otherwise, prints the contents of `onboard.txt` (the recipe) to stdout and exits 0.

A `--mark-complete` flag (mutually exclusive with the default mode) writes `onboarded: true` to the manifest and exits 0. The recipe instructs the agent to invoke `taskless onboard --mark-complete` only after the user has explicitly confirmed they're done.

**Why not just `taskless help onboard`?**

Two reasons. First, `taskless help <topic>` is a generic recipe-printer with no awareness of state — it would print the recipe regardless of whether the user is already onboarded. Putting the gate in a dedicated subcommand keeps the help surface generic and the gating logic in one place. Second, the `--mark-complete` write needs _some_ CLI surface; bundling it under `taskless onboard` keeps the verb's surface area cohesive ("everything you can do about onboarding lives here").

`taskless help onboard` SHALL still work and SHALL still print the same recipe content — there's no special variant. The CLI subcommand and the help topic share the embedded text.

**Alternatives considered:**

- Put the gate logic inside the recipe (agent reads `taskless.json` itself). Rejected: forces every host agent to re-implement gate logic; deterministic state checks belong in the CLI.
- Make the agent edit `taskless.json` directly to mark onboarded. Rejected: write logic spreads across CLI and agent; harder to evolve the schema; harder to test.

### Decision 2: `onboarded` is a 3-state optional boolean field

The `taskless.json` `install` object gains an optional `onboarded?: boolean` field with three meaningful states:

| Value   | Meaning                                           | When the gate fires             |
| ------- | ------------------------------------------------- | ------------------------------- |
| absent  | Never explicitly onboarded (post-install default) | Recipe runs                     |
| `false` | Explicitly declined or reset                      | Recipe runs                     |
| `true`  | User confirmed they're done                       | Recipe refused unless `--force` |

The bootstrap install (`taskless init`) does NOT set this field. The field is only ever written by `taskless onboard --mark-complete` after the agent has explicit user confirmation, mirroring the `--anonymous` consent pattern. There is no separate decline state — declining is a per-conversation behavior governed by the skill, not persisted.

**Why not a richer enum (`unset`/`in-progress`/`declined`/`done`)?**

Two reasons. First, none of the other states unlock distinct behavior — only "done vs. not done" affects the gate. Second, the simpler shape avoids a future migration if we ever need to add states; the boolean is forward-compatible because the field is optional.

### Decision 3: `--force` overrides any value of `onboarded`

`taskless onboard --force` runs the recipe regardless of state — works whether `onboarded` is absent, `false`, or `true`. The flag is documented but not advertised in the standard recipe; the CLI's "already onboarded" message mentions it as the override.

This avoids the pitfall where `--force` only works in the `true` state — if a user wants to re-run onboarding for any reason (new codebase, new tools available), one consistent flag should always work.

### Decision 4: Skill description trigger is widened with named-tool suppression

The `skill-taskless` description gains a new clause:

> Also trigger when the user asks to add/write/create a rule and does NOT name a specific lint/format/static-analysis tool. Examples of named tools that suppress this trigger: eslint, ruff, biome, ast-grep. The list is illustrative — any named lint/format/static-analysis tool suppresses the trigger.

Behavior on this trigger is **quiet suggestion**, not an interrogation:

- The skill SHALL surface a single-line offer ("I can capture this as a Taskless rule if you want — say so, or I'll proceed with X").
- If the user declines or ignores the offer, the agent SHALL proceed with whatever it would have done without the skill, and SHALL NOT re-offer in the same conversation.
- If the user accepts, the skill router takes over normally and proceeds via `npx @taskless/cli help rule create`.

**Why not a fixed allowlist of suppressing tool names?**

The CLI release cycle can't keep up with the long tail of linters/formatters/SAST tools (ruff, oxlint, knip, semgrep, clippy, golangci-lint, stylelint, rubocop, etc.). A fixed list is either too short (false-positive volunteers when users name a tool we forgot) or too long (eats the description's 1024-char budget). Spirit-of-the-rule wording with four named examples (eslint = JS/TS classic, ruff = Python, biome = modern unified, ast-grep = semantic/structural) gives the model both a heuristic and concrete pattern-matching anchors.

**Why intentionally widen a trigger we previously narrowed?**

The prior narrowing was correct _for users who already knew about Taskless and didn't want it suggested_. With the proactive-onboard goal, we accept a regression on that audience in exchange for helping users who installed Taskless but never used it productively. The mitigation set (quiet wording, named-tool suppression, in-conversation sticky decline) bounds the cost.

### Decision 5: Recipe is conversational, not a fixed phase script

The `onboard.txt` recipe instructs the agent to:

1. Open with a short menu of _known_ sources for rule candidates: TODOs/FIXMEs (ripgrep), agent-memory files (CLAUDE.md / AGENTS.md / .cursorrules / etc.), recent PR review comments (if `gh` is available), issue-tracker tickets (if a relevant MCP is detected).
2. Encourage the user to name additional sources the agent wouldn't know about (e.g., a team wiki page, a specific doc).
3. For each chosen source, scan and filter for _high-signal_ candidates — patterns that appear repeatedly, comments that cite a doc/style guide, things that block PR merges. Filter out one-off nits and pure formatting.
4. Synthesize a bullet list where each bullet is a hypothetical rule: a kebab-case name and a one-line description of what it would enforce.
5. For each bullet, offer to materialize it via the existing `/tskl create rule` flow.
6. At the end, ask the user whether they consider onboarding complete; on yes, run `taskless onboard --mark-complete`.

**Why conversational over fixed phases?**

The available sources differ wildly across users (some have GitHub, some have GitLab, some have neither; some use Linear, some Jira, some nothing; some have rich CLAUDE.md, some don't). A fixed phase script would either skip valuable sources for users who have them or run irrelevant phases for users who don't. The agent can see its own tool list — it knows what MCPs are available without us encoding that. Letting the agent + user decide together produces better signal-to-noise than a one-size-fits-all script.

### Decision 6: Init prints a one-line trailer to nudge onboarding

After the install summary, `taskless init` prints a single line such as:

```
Next: run /tskl onboard in your AI tool to discover rule candidates from your codebase.
```

This is added to both the wizard and the non-interactive path. It is not gated on the absence of `onboarded` — the trailer is informational, not an enforced flow. We don't want to fail an install just because the manifest reads `onboarded: true` from a previous run.

## Risks / Trade-offs

- **Risk: The widened trigger feels like advertising.** → Mitigation: enforce _quiet single-line_ suggestion wording in the skill body; in-conversation sticky decline; named-tool suppression. If real-world feedback shows the trigger is still annoying, the skill description can be re-narrowed in a follow-up without changing the rest of the change.

- **Risk: The recipe takes a long time on large repos.** → Mitigation: the recipe is conversational — the agent confirms scope with the user before running long scans. The agent SHOULD show progress on multi-source scans (a status line per source, not per file).

- **Risk: PR-comment scanning surfaces noisy candidates.** → Mitigation: the recipe explicitly instructs the agent to filter for _repeated patterns_, _cited docs_, and _merge-blocking comments_, not for one-off nits. The bullet output makes it easy for the user to decline candidates.

- **Risk: A user who manually edited `taskless.json` to set `onboarded: true` later wants to re-run.** → Mitigation: documented `--force` flag; the "already onboarded" message tells them about it.

- **Trade-off: No persistent "declined" state.** Users who decline the proactive suggestion will be re-asked in future conversations. Accepted: storing per-user decline state is more complexity than it's worth, and the suggestion is intentionally low-friction.

- **Trade-off: Recipe success depends on agent quality.** A weaker host agent will produce weaker rule suggestions. We accept this — the alternative (encoding a deterministic suggestion engine in the CLI) defeats the point of the agent-skills architecture.

## Migration Plan

This change is additive at the schema level and observable-but-non-breaking at the trigger level. Migration steps:

1. **Schema**: The `onboarded` field is new and optional; no `taskless.json` migration is required (existing manifests with no `onboarded` field read as "not onboarded" naturally). No bump to the migrate-runner version is needed.
2. **Skill**: Existing installs do not auto-update. Users who upgrade the CLI (or run `taskless update`) will pick up the new skill body and description on the next install. Users who never re-run init will keep the v0.7.0 skill — that's acceptable; the `onboard` command works regardless.
3. **Help**: The `onboard` topic appears in the `taskless help` index after the new build is released.
4. **Init trailer**: Appears on the next CLI release; existing installs are unaffected until they re-run init.

No rollback complexity beyond standard "publish a previous CLI version."
