## Context

Today the CLI embeds skill/command content at build time (`import.meta.glob`) and, on `init`/`update`, writes a **full copy** of every skill into each detected tool's directory — `.claude/skills/`, `.cursor/skills/`, `.opencode/skills/`, and `.agents/skills/` (Codex). Each detected tool is an independent install target in `applyInstallPlan` ([install.ts](packages/cli/src/install/install.ts)), so an N-tool repo gets N identical `SKILL.md` files. They drift, they churn PR diffs, and staleness is checked per-copy.

A customer trying to standardize on one shared skill surfaced the root cause: the model conflates _where content lives_ with _where tools read it_. Codex's `installDir` is `.agents`, so the Codex target's `removeOwnedSkills` does `rm -rf .agents/skills/taskless` — destroying the directory other targets point into. With symlinks, `update` fails; with wrapper files, `applyInstallPlan` clobbers the wrapper with a full copy because it has no notion of a target being a pointer.

Research (Dec 2025 Agent Skills spec; per-tool docs and open issue trackers) established: `.agents/skills/<name>/SKILL.md` is the cross-tool standard, read **natively** by OpenCode, Cursor, and Codex; symlink discovery is broken or unreliable on all three and Windows-checkout-fragile; Claude Code reads only `.claude/skills/`.

## Goals / Non-Goals

**Goals:**

- A single canonical store for skill and command content, in a directory **no tool target ever installs into or cleans up**.
- Every tool location served by a thin, ordinary-file reference stub — no symlinks anywhere.
- `update` that rewrites canonical content without clobbering stubs or destroying the canonical source.
- A manifest that distinguishes the `canonical` store from `reference` tool locations.
- Existing multi-copy and symlinked installs converge on the canonical layout via the migration system.

**Non-Goals:**

- No Claude Code plugin/marketplace distribution work — noted as a future path, out of scope here.
- No change to skill _authoring_ layout (`skills/taskless/SKILL.md` in this repo) or build-time embedding.
- No symlink support — explicitly rejected (see Decisions).

## Decisions

### Decision: Canonical content lives in `.taskless/`, not `.agents/` or a tool directory

Skill content goes to `.taskless/skills/<name>/SKILL.md`; command content to `.taskless/commands/tskl/<name>.md`. `.taskless/` is Taskless's owned namespace — already committed, already home to `rules/`, `rule-tests/`, `taskless.json`.

Two alternatives were considered and rejected:

- **`.taskless/agents/*`** (OSS-8's original framing) — fine as an owned namespace, but the sub-path is arbitrary; `.taskless/skills/` + `.taskless/commands/` mirrors the kind of content and is clearer.
- **`.agents/skills/` as canonical** — `.agents/skills/` is read natively by three tools, which is attractive, but it makes `.agents/` do double duty: canonical store _and_ a tool read-path. That dual role **is** the customer's bug — Codex's target cleanup lives in `.agents`. It is also a _shared_ namespace other installers write into, making cleanup a prefix-match in someone else's room, and the standard is young.

Putting the canonical in `.taskless/` separates "where content lives" from "where tools read it." No install target ever points its write/cleanup at `.taskless/skills/`, so the canonical-destruction bug becomes **structurally impossible** rather than something guarded against in code. `.taskless/` is collision-free (no other tool reads or writes it), and the layout is decoupled from the fate of the `.agents/` standard.

### Decision: Uniform per-tool stubs — every selected directory is a peer target

Each selected tool directory receives its own stub — an ordinary `SKILL.md` (or command `.md`) with real `name`/`description` frontmatter (so the tool discovers and triggers it) and a body that says "read `.taskless/skills/<name>/SKILL.md` and follow it," without inlining canonical instructions.

- `.claude/skills/<name>/SKILL.md` + `.claude/commands/tskl/<name>.md` — Claude Code.
- `.cursor/skills/<name>/SKILL.md` + `.cursor/commands/tskl/<name>.md` — Cursor.
- `.opencode/skills/<name>/SKILL.md` — OpenCode (no commands).
- `.agents/skills/<name>/SKILL.md` — generic Agent Skills location, including Codex (no commands).

An alternative was considered and rejected: **routing** — since Cursor, OpenCode, and Codex read `.agents/skills/` natively, "enable Cursor" could be routed to a single shared `.agents/` stub and `.cursor/skills/` left unwritten. Rejected for two reasons: (a) it makes `.agents/` a special case in an otherwise uniform model, and the routing logic ("which tools collapse onto `.agents/`") is exactly the kind of cleverness that ages badly; (b) it depends on each tool's native `.agents/` discovery actually working, which the research found uneven. The uniform model treats `.agents/` as an ordinary peer: every selected directory gets exactly one stub, no routing, no special cases. The cost is one tiny stub per tool instead of a shared one — featherweight, and content is still single-sourced so drift is unaffected.

Each stub points **directly** at the canonical file — never at another stub — so resolution is always a single hop.

### Decision: No symlinks — stubs are ordinary files

Symlinks are rejected on three independently sufficient grounds: (a) Cursor, OpenCode, and Codex all have open symlink-discovery bugs; (b) Windows checkout without Developer Mode materializes a symlink as a plain text file containing the link path; (c) symlinks invite exactly the destructive-cleanup failure this change exists to remove. An ordinary stub file works on every OS and VCS and survives archives/ZIP exports.

_Alternative considered:_ hardlinks — rejected because `git clone` materializes independent copies, so they don't survive distribution.

### Decision: Targets carry a `mode` (`canonical` | `reference`)

The install state (`install/state.ts`) records a per-target `mode`. The `.taskless` target is `canonical`; every tool location is `reference`. `applyInstallPlan` branches on it: `canonical` gets full content written/rewritten; `reference` gets a stub generated only when absent or when frontmatter has drifted, and is **never** overwritten with full content. A legacy manifest with no `mode` defaults entries to `canonical`, preserving backward compatibility.

### Decision: The wizard's location step becomes tool selection

The wizard's location step is reframed from "where should skills be installed?" to "which tools do you want to enable Taskless for?" — a fixed multiselect of `.claude/`, `.cursor/`, `.opencode/`, `.agents/`, with detected entries pre-checked and `.agents/` the default when nothing is detected. The canonical `.taskless/` store is not a selectable entry: it is always written and always maintained, independent of the selection. Each checked entry produces one `reference` stub target; the unchecked entries produce nothing.

### Decision: Cleanup is manifest-driven; convergence is self-healing, not a migration

The destructive `rm -rf` glob in `removeOwnedSkills` is removed. Cleanup operates solely on the recorded-manifest diff (`computeInstallDiff`): only paths a prior manifest recorded are removed, respecting each entry's `mode`.

Converging an existing install onto the canonical-plus-stub layout is **not** done with a `.taskless/` migration. Two reasons: a migration that needs embedded content and the tool catalog would import `install/install.ts`, forming an import cycle through `state.ts` → `migrate.ts`; and migrations run on _every_ `ensureTasklessDirectory` call, including `taskless check`, so a convergence migration would write skill files into a repo during an unrelated command.

Instead, `applyInstallPlan` is **self-healing**. Every stub carries a frontmatter marker — `metadata.type: shim` (see `isShimStub`) — so a stub is distinguishable from a full copy without inspecting the body. When writing a `reference` target, `applyInstallPlan` rewrites the file unless it is already a current, non-drifted shim stub. That single rule converges every stale shape: a missing file, a full copy left by an older install, a symlink, or a drifted stub — all on the next `init`/`update`, with no migration. A legacy manifest with no `mode` still reads as `canonical`, so the manifest change needs no migration either.

## Risks / Trade-offs

- **A stub per tool rather than a shared one** → The uniform model writes one stub into each selected tool directory instead of routing several tools onto a shared `.agents/` stub. Each stub is featherweight (~6 lines) and content is single-sourced, so drift is unaffected; the trade buys a uniform, routing-free model.
- **Stub frontmatter drift from canonical** → A stub copies the canonical `name`, `description`, and `metadata.version`; if any change, the stub goes stale. Mitigation: `update` regenerates a stub _as a stub_ when any of those drifts — refreshing the frontmatter only, never writing full body content. A version bump therefore refreshes every stub on the next `update`.
- **Double discovery** → A tool that reads more than one of the selected directories (e.g. a tool reading both `.agents/` and its own dir) sees two stubs for the same skill. Both resolve to the same canonical file, so behavior is identical; worst case is a duplicate listing. Acceptable.
- **A consumer manually symlinked things** (the customer's current state) → `applyInstallPlan` `lstat`s each reference path; a symlink is always replaced with a real stub file rather than written through.
- **A leftover full copy reads as drift-free** → An old per-tool full `SKILL.md` has `name`/`description` matching canonical, so a `name`/`description` drift check alone would never regenerate it. Mitigation: the `metadata.type: shim` marker — a full copy lacks it, so `applyInstallPlan` treats any non-shim file as something to convert.

## Migration Plan

1. Ship the new install model as the default `init`/`update` behavior (no flag).
2. No `.taskless/` schema migration is added. The manifest's new `mode` field is additive and backward-compatible (absent → `canonical`).
3. On a user's next `taskless init`/`update`, `applyInstallPlan` self-heals: it seeds the canonical store and rewrites every reference file that is not a current shim stub (full copies, symlinks, drifted stubs).
4. Rollback: reverting the CLI leaves a valid `.taskless/` store; an older CLI would re-create per-tool full copies, which is the prior behavior — no corruption.

## Open Questions

- Should the canonical `.taskless/skills/` store carry the staleness `metadata.version`, with stubs version-free — making staleness a single-file check? (Leaning: yes.)
- Does the install summary need a per-tool "served by `.taskless/` canonical" line, or one canonical line plus the tool list? (Leaning: one canonical line; keep summary terse.)
