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

### Decision: Every tool location gets a reference stub; `.agents/` included

Each tool location receives a stub — an ordinary `SKILL.md` (or command `.md`) with real `name`/`description` frontmatter (so the tool discovers and triggers it) and a body that says "read `.taskless/skills/<name>/SKILL.md` and follow it," without inlining canonical instructions.

- `.claude/skills/<name>/SKILL.md` — stub for Claude Code.
- `.agents/skills/<name>/SKILL.md` — stub serving OpenCode, Cursor, and Codex, which read `.agents/skills/` natively. One stub covers all three; `.cursor/skills/` and `.opencode/skills/` are not written.
- `.claude/commands/tskl/<name>.md` and `.cursor/commands/tskl/<name>.md` — command stubs.

`.agents/` holding a _stub_ rather than the real skill is mildly unidiomatic (the standard expects real content there), but the stub is itself a conformant, working skill. The upside: if/when `.agents/` is trusted enough to be canonical, "promotion" is just regenerating which file is full vs. stub — a non-event, no data migration.

Each stub points **directly** at the canonical file — never at another stub — so resolution is always a single hop.

### Decision: No symlinks — stubs are ordinary files

Symlinks are rejected on three independently sufficient grounds: (a) Cursor, OpenCode, and Codex all have open symlink-discovery bugs; (b) Windows checkout without Developer Mode materializes a symlink as a plain text file containing the link path; (c) symlinks invite exactly the destructive-cleanup failure this change exists to remove. An ordinary stub file works on every OS and VCS and survives archives/ZIP exports.

_Alternative considered:_ hardlinks — rejected because `git clone` materializes independent copies, so they don't survive distribution.

### Decision: Targets carry a `mode` (`canonical` | `reference`)

The install state (`install/state.ts`) records a per-target `mode`. The `.taskless` target is `canonical`; every tool location is `reference`. `applyInstallPlan` branches on it: `canonical` gets full content written/rewritten; `reference` gets a stub generated only when absent or when frontmatter has drifted, and is **never** overwritten with full content. A legacy manifest with no `mode` defaults entries to `canonical`, preserving backward compatibility.

### Decision: Cleanup is manifest-driven; existing installs converge via migration

The destructive `rm -rf` glob in `removeOwnedSkills` is removed. Cleanup operates solely on the recorded-manifest diff (`computeInstallDiff`): only paths a prior manifest recorded are removed, respecting each entry's `mode`. A new `.taskless/` migration (`filesystem/migrations/`) sweeps obsolete `.cursor/skills/`/`.opencode/skills/` full copies, replaces any symlinked tool entry with a real stub, seeds the canonical `.taskless/` store, and rewrites `taskless.json` with per-target `mode`. The bootstrap system already runs migrations on the next `update`.

## Risks / Trade-offs

- **One extra stub vs. an `.agents/`-canonical model** → The `.taskless/` model writes a stub in `.agents/` where an `.agents/`-canonical model would write the real file. One extra featherweight file; content is still single-sourced, so drift is unaffected. Worth it for the structural bug elimination.
- **Stub `description` drift from canonical** → If the canonical `description` changes, stubs go stale. Mitigation: `update` regenerates a stub _as a stub_ when frontmatter drifts — refreshing `name`/`description` only, never writing full body content.
- **Double discovery** → A tool reading both `.agents/` and `.claude/` (OpenCode reads both) sees two stubs for the same skill. Both resolve to the same canonical file, so behavior is identical; worst case is a duplicate listing. Pre-existing in any multi-target model; acceptable.
- **A consumer manually symlinked things** (the customer's current state) → The migration detects a symlinked tool entry and replaces it with a real stub file rather than writing through the link.
- **`.agents/` standard regressing for a tool** → If a tool stops reading `.agents/`, it can be given its own stub via the same `mode: reference` mechanism — the model already generalizes to one stub per tool location.

## Migration Plan

1. Ship the new install model as the default `init`/`update` behavior (no flag).
2. Add a `.taskless/` migration that: writes the canonical `.taskless/skills/` and `.taskless/commands/` store; removes obsolete `.cursor/skills/`/`.opencode/skills/` full copies recorded in the prior manifest; replaces any symlinked tool entry with a real reference stub; and rewrites `taskless.json` install state with per-target `mode`.
3. On a user's next `taskless update`, the bootstrap migration runner applies step 2; the install summary reports removed obsolete copies.
4. Rollback: the manifest change is additive (legacy entries read as `canonical`). Reverting the CLI leaves a valid `.taskless/` store; an older CLI would re-create per-tool full copies, which is the prior behavior — no corruption.

## Open Questions

- Resolved — empty `.cursor/skills/`/`.opencode/skills/` directories are left as-is. Git does not track empty directories, so once the obsolete copies are swept they disappear from commits and clones automatically; an empty dir only lingers in a local working tree. Adding code to delete it would be cosmetic-only, so the migration sweeps files and stops there.
- Should the canonical `.taskless/skills/` store carry the staleness `metadata.version`, with stubs version-free — making staleness a single-file check? (Leaning: yes.)
- Does the install summary need a per-tool "served by `.taskless/` canonical" line, or one canonical line plus the tool list? (Leaning: one canonical line; keep summary terse.)
