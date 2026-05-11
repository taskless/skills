## Context

The Taskless skills bundle today is ten `SKILL.md` files (~734 lines total) plus six near-duplicate slash commands (~363 lines total) and twelve help-text files (~270 lines total). The 1,367 lines describe roughly seven user intents. A customer reported that loading Taskless caused the Claude harness to evict other skills from working set; we know Codex behaves similarly. The motivating problem is concrete: the per-skill always-loaded surface is causing measurable harm to users.

A secondary issue is trigger quality. The `taskless-create-rule` skill description lists `"create a rule"`, `"add a lint rule"`, `"new rule for"`, `"detect this pattern"` — three of four phrases never reference Taskless and over-fire in any repo using ESLint. The `taskless-improve-rule` and `taskless-delete-rule` skills have the same problem. The auth/info/CI skills are properly anchored on the word `taskless`. Consolidation is a chance to commit to a uniform anchored trigger policy.

The CLI's `help` subcommand already exists at `packages/cli/src/commands/help.ts`. It loads `.txt` files via `import.meta.glob` at build time, looks them up by hyphen-joined positional args, and prints them. It already serves the "fetch documentation on demand" need; this change extends it into the canonical recipe channel for agents.

Constraints:

- The single skill description has to do trigger work for all seven intents without over-firing on generic lint/rule/check verbs.
- Recipes are fetched via shell — sandboxed agents that can't run shell commands are excluded. Today's skills work for them via inline bodies; we are accepting this regression.
- The CLI's existing install-state file (`state.ts`) tracks which files were written. Reinstall is idempotent and can clean up obsolete files from prior versions. We rely on this to avoid shipping a separate migration script.
- Action recipes return markdown, not JSON. The CLI commands they invoke (`rule create`, `rule improve`, etc.) MUST do their own filesystem writes — agents must not parse JSON to write files.
- `citty` is the CLI framework. Adding a global `--anonymous` flag is a per-command flag declaration with shared parsing — citty does not have native global flags, so each command's `args` block adds the flag.

## Goals / Non-Goals

**Goals:**

- Collapse ten skills into one consolidated `taskless` skill with a tight router body.
- Collapse six slash commands into one `tskl` command that accepts a free-form `$ARGUMENTS` ask.
- Move all per-task agent instructions out of skill bodies and into `tskl help <topic>` recipes fetched on demand.
- Anchor the consolidated skill description on Taskless-specific triggers; commit to "do not trigger on generic rule/lint/check verbs without a Taskless reference."
- Standardize recipe shape (Goal/Preconditions/Steps/Schema/Errors/See Also) so agents can pattern-match consistently.
- Embed JSON Schema for `--from` inputs inline in recipes (no separate `--schema` flag).
- Make `--anonymous` a top-level CLI flag with consistent per-command behavior; absorb the anonymous-skill variants as filesystem-driven recipe variants (`<topic>.anonymous.txt`).
- Rename CLI verb from `rules` to `rule` for grammatical consistency with how recipes are addressed (`tskl help rule create`).
- Standardize CLI error output codes so recipes can reference them stably.
- Auto-route non-TTY `npx @taskless/cli` to `help` so agents and pipes see something useful.
- Hard cut to v0.7.0; rely on existing version-check + idempotent reinstall to migrate users.

**Non-Goals:**

- Formal Cursor / Codex skill+command support beyond what already exists (deferred — they're known to evict similarly, so consolidation helps them too).
- Soft deprecation of v0.6 skill names (no `taskless-create-rule` shim that prints a warning — direct removal).
- A JSON-only `tskl help` output mode for agents that prefer JSON (markdown is sufficient).
- Static `references/` fallback for sandboxed agents that can't run shell (documented limitation; the CLI is shell-based anyway).
- A broader CLI error catalog refactor — only standardize what recipes need.
- Splitting `tskl help auth` into separate login/logout/status topics (one recipe with branches per the agreed granularity).
- Keeping `tskl verify` and `tskl meta` as user-discoverable topics (they remain agent-internal CLI commands invoked from within other recipes; they are not surfaced in `tskl help` index).
- Per-topic versioning beyond a simple integer in the recipe header (no semver).
- Carrying old telemetry event names alongside new ones — hard rename, accept the analytics blip.

## Decisions

### Single consolidated skill (not a hybrid "fat shortcut" approach)

We considered keeping a couple of "fat shortcut" skills inline (e.g., `taskless-info` is only 52 lines, runs in 5 seconds, every CLI call adds latency). Rejected — uniform consolidation is simpler to maintain, removes the question of "which skills get fattened?", and the latency cost of an extra `tskl help info` call is negligible (npx caches after first run; help command is local and fast).

### Anchored trigger policy

The consolidated skill description requires the user's message to reference Taskless explicitly OR for the `.taskless/` directory to exist in cwd. Generic rule/lint/check phrasing without a Taskless anchor SHALL NOT trigger.

This is a strict improvement over today's mixed-bag where rule-create/improve/delete fire promiscuously. Recovery for the case where a user with `.taskless/` says "create a lint rule" without anchoring: the skill body's first step is to confirm with the user before proceeding ("It looks like Taskless is initialized here — should I use Taskless?"), making graceful failure cheap.

Alternative considered: context-aware triggering ("trigger on rule/lint verbs IF `.taskless/` exists"). Rejected — descriptions don't run code, so this would be a soft hint the agent might ignore, and it preserves the over-fire problem in non-Taskless repos.

### Skill body says "you do NOT have the steps"

The skill body uses blunt framing — "You do NOT have the steps for any Taskless action in your context. The current canonical recipes live behind `npx @taskless/cli help <topic>`. Always fetch the recipe first; do not improvise from prior knowledge." — to fight the agent's tendency to skip the help fetch and improvise from prior knowledge of "create a rule" generically. This kind of forceful framing has been observed to work on agents.

### Slash command is a thin doorway, not a parallel implementation

`/tskl <ask>` files and the consolidated skill body share routing logic. The slash command file (`commands/tskl/tskl.md`) is ~10 lines: "the user invoked Taskless via `/tskl` with `$ARGUMENTS`; if a topic can be inferred, fetch the recipe and proceed; otherwise ask the user what they want." Same flow as auto-trigger, different doorway.

### Anonymous variants are filesystem-driven, with a compile-time map

`packages/cli/src/help/<topic>.anonymous.txt` is the convention. A build-time map of which topics have variants is embedded at compile time so runtime lookup is O(1) and consistent. `tskl help rule create --anonymous` returns the variant; topics without a `.anonymous.txt` (because anonymous is a no-op there) fall back to the standard recipe.

Alternative considered: a central registry / manifest in code listing which topics have variants. Rejected — the filesystem already encodes this; an additional registry is a synchronization burden.

Alternative considered: emit the anonymous variant inline as a `## Anonymous Mode` section in the standard recipe. Rejected — for rule create/improve, the anonymous flow is substantively different (different file writes, different verify loop), so mixing them in one recipe makes both harder to follow.

### `--anonymous` is universally accepted, with per-command behavior

Rather than "strict" (only accepted where it makes sense, error elsewhere) or "permissive no-op" (silently ignored everywhere), we go strict-ish:

- `rule create`, `rule improve` — switch to local-only flow
- `rule delete`, `rule verify`, `check`, `auth logout`, `init` — accepted as no-op
- `info` — skip API probe, report local state only
- `auth login` — error: "auth commands cannot be anonymous"

The `auth login` error is the one place we reject the flag because there it's nonsensical and the error message is the right signal. Everywhere else, accepting it (even as no-op) means the agent never has to remember which commands accept it.

### Recipe template is fixed and includes a header version

```
# Topic: <name>     (CLI v0.7.1 / topic v1)

## Goal
## Preconditions
## Steps
## Input schema    (zod-to-json-schema, code-fenced)
## Errors          (code → user-facing fix)
## See Also
```

The header line lets agents detect mismatch if they fetch twice with a CLI upgrade in between. Topic version is a small integer maintained by the recipe author; bumped when the recipe changes meaningfully. Not semver — recipes are agent-facing and versioning beyond an integer is overkill.

### CLI verb singular: `rule` not `rules`

`tskl help rule create` reads naturally only if the agent's next command is `npx @taskless/cli rule create`. We rename the CLI subcommand from plural to singular to match. Affects `rule create`, `rule improve`, `rule delete`, `rule verify`, `rule meta`. The internal source file (`packages/cli/src/commands/rules.ts`) MAY stay named `rules.ts` — that's an internal detail.

### Error codes are stable, recipes reference them by name

Each action recipe contains an `## Errors` section that maps error codes to user-facing fixes. For this to work, the CLI must emit those codes consistently. Action commands SHALL output a stable JSON shape including a `code` field on failure when `--json` is set:

```json
{ "ok": false, "code": "AUTH_REQUIRED", "message": "..." }
```

This is the only error-handling change in scope — we standardize what recipes need, not the entire error catalog.

### Action commands write their own files; agents don't post-process

Recipes return markdown only — never JSON. Action commands (`rule create`, `rule improve`, etc.) write their outputs (`.taskless/rules/<id>.yml`, `.taskless/rule-tests/<id>.yml`, etc.) directly to disk. Agents invoke and report; they do not parse output to construct files. Where today's skills do post-CLI file work, we move that work into the CLI as part of this change.

### Telemetry: hard rename, no dual-emit

```
help_<topic>              agent fetched a recipe (intent signal)
help_index                agent fetched the topic list (probable confusion)
cli_<action>              action started (e.g. cli_rule_create)
cli_<action>_completed    action finished (success/failure in props)
```

Existing `cli_help_<topic>` events go away in the same release. The new taxonomy is a strict improvement and dual-emit just delays the cleanup. Wrong-topic detection becomes a derivable funnel signal: `help_<topic_a>` → no `cli_<action_a>` → `help_<topic_b>` indicates the agent re-routed.

### Non-TTY `npx @taskless/cli` routes to help

```
$ npx @taskless/cli
Taskless CLI — non-interactive context detected.
For interactive install, run from a terminal.
For agent recipes, use:  npx @taskless/cli help

[then prints the help index]
```

Better than silently printing help — explains why interactive didn't run. Explicit `npx @taskless/cli init` still runs the wizard if a TTY is attached.

### Wizard simplification

Single skill means the optional-skill selection step is removed entirely. Wizard becomes: tool selection → auth → install. Step file `packages/cli/src/wizard/steps/optional-skills.ts` (or equivalent) is deleted along with its tests.

### Migration via existing state.ts + version check

`packages/cli/src/install/state.ts` already records which files were written per target. The new init reads previous state, computes which files are obsolete, deletes them, writes the new single skill + command, updates state. No special migration script. Existing v0.6 skills include a version check that surfaces "out of date" prominently — that's the user's prompt to reinit. User-customized installed skills are not protected; the consolidated skill replaces them. Skills are tool installations, not user-editable artifacts.

## Risks / Trade-offs

- **The consolidated description over-fires.** A single description has to cover all Taskless intents. Even with anchoring, an agent might fire on borderline phrasing.
  → Mitigation: anchor on "taskless" explicitly OR `.taskless/` references; the skill body's first step asks the user to confirm before proceeding when ambiguous.

- **The agent picks the wrong topic.** "Improve a rule" vs "create a rule" can be ambiguous from a one-line user message. The agent might fetch and follow the wrong recipe.
  → Mitigation: the topic disambiguation table in `tskl help` (no args) explicitly contrasts topics ("use this NOT that"); each recipe's header restates "this is for X — if you wanted Y, run `tskl help Y` instead"; the `cli_help_<topic_a>` → `help_<topic_b>` telemetry funnel reveals re-routing patterns.

- **The agent skips the help fetch and improvises.** Today's skills include the recipe inline; agents read and follow. The new design requires an extra shell call.
  → Mitigation: blunt framing in the skill body ("You do NOT have the steps... do not improvise from prior knowledge"). Accept residual risk; instrument the funnel to detect agents that go straight to action commands without a preceding `help_<topic>` event.

- **First-run latency.** `npx @taskless/cli` cold-fetch is 5–15s. Agents may report "command timed out" on first invocation.
  → Mitigation: recipe headers and the consolidated SKILL.md acknowledge this so agents don't misreport. After first run, npx caches.

- **CLI verb rename breaks existing scripts and CI invocations.** Anyone running `npx @taskless/cli rules create` in a script breaks.
  → Mitigation: changeset marks BREAKING; release notes call it out. We do not ship a `rules` alias — hard cut keeps the surface clean.

- **Telemetry rename breaks dashboards.** Anyone with PostHog dashboards keyed on `cli_help_<topic>` event names will see flat-line.
  → Mitigation: accept the analytics blip; the new taxonomy is a strict improvement and the team can update queries in one pass. Document the rename in release notes.

- **Sandboxed agents that can't run shell are excluded.** Today's skills work via inline bodies; the new design requires shell access for `npx @taskless/cli help`.
  → Mitigation: documented limitation. Taskless's CLI is shell-based anyway, so a sandboxed agent couldn't run any actions either; recipe fetching is just one more shell call.

- **Wrong-topic recipe causes user confusion mid-flow.** Agent picks `rule improve` for what was actually a `rule create` request, starts asking improvement-flavored questions.
  → Mitigation: recipe header self-check as above; recipe Step 1 for both create and improve includes "confirm with the user that you understood their intent."

- **Anonymous variant drift.** If `<topic>.anonymous.txt` and `<topic>.txt` share most steps, they can drift over time as one is updated and the other isn't.
  → Mitigation: small problem because anonymous variants only exist where the flow is genuinely different (currently just `rule create` and `rule improve`). Where flows overlap, the variant file MAY be a thin wrapper that quotes shared sections; if drift becomes painful, refactor to shared partials in a future change.

- **Manual edits to installed skill files lose changes.** A user who hand-edited `~/.claude/skills/taskless-create-rule/SKILL.md` loses their edits when init removes the file during consolidation.
  → Mitigation: this matches existing behavior — installed skills are CLI-managed artifacts, not user-editable source. The release notes call out the consolidation so users with custom edits know to back them up first.

- **The `--anonymous` flag's "no-op" shape may surprise users.** Someone running `taskless check --anonymous` might expect different output.
  → Mitigation: help recipes for each topic note `--anonymous` behavior explicitly. The flag is documented in the consolidated SKILL.md's `## --anonymous` section.

## Migration Plan

1. Ship v0.7.0 with the consolidated skill, single command, renamed CLI verb (`rules` → `rule`), `--anonymous` flag, recipe template, embedded schemas, telemetry rename, and removed `--schema` flag in a single release.
2. Existing v0.6 installs: the version-check pattern in installed skill bodies surfaces "out of date" to the agent; the agent prompts the user to run `npx @taskless/cli` to update.
3. On running init after upgrade, the existing `state.ts` records which files were previously written. The new init removes the obsolete files (10 skill files + 6 command files) and writes the new single skill + command. Init reports what was removed for transparency.
4. CHANGELOG marks BREAKING with a clear list: CLI verb rename, removed `--schema`, removed individual skill names, telemetry event rename. Changeset handles version bump and changelog plumbing.
5. Rollback: reverting the CLI release returns users to v0.6 plumbing. Re-running v0.6 init reinstalls the ten skills from the v0.6 bundle (the install state is overwritten). No special rollback handling required.

## Open Questions

- **What does `tskl help` (no args) print for someone who pipes the output?** Today the help command writes to stdout regardless. We're keeping stdout as the recipe channel; warnings go to stderr. The non-TTY entry point at `npx @taskless/cli` (no args) prints a brief preamble before delegating to help. Resolved.
- **Do we need a `tskl topics` command in addition to `tskl help` (no args)?** Probably not — `tskl help` with no args already returns the topic list. One canonical surface.
- **Does the consolidated skill keep a `metadata.commandName` field?** Yes — set to `tskl` so installer plumbing that maps skills to commands continues to work.
- **What's the topic version starting integer?** Every recipe ships at `topic v1` for the v0.7.0 release. Bumps happen when the recipe changes meaningfully (steps reordered, schema changes, error codes added). Cosmetic edits don't bump.
- **Should the no-TTY message route also mention `--no-interactive`?** The wizard already supports `--no-interactive` for scripted installs; the non-TTY auto-route is for "ran with no args at all." Different cases; the no-TTY message can mention `--no-interactive` as a one-liner alternative.
