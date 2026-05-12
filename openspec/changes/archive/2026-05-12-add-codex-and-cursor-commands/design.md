## Context

The CLI's tool registry in `packages/cli/src/install/install.ts` already supports a multi-tool model: each `ToolDescriptor` has detection signals separated from install paths, and a per-tool optional `commands` channel. Today the registry has Claude Code, OpenCode, and Cursor entries plus an `AGENTS_FALLBACK` constant used when no tools are detected. Skills install to `<installDir>/skills/<name>/SKILL.md`; commands install to `<installDir>/<commands.path>/<filename>` (only Claude Code currently uses commands).

Two findings from researching official Codex and Cursor docs:

1. **Codex auto-discovers `.agents/skills/`**: Per `developers.openai.com/codex/skills`, "Codex scans `.agents/skills` in every directory from your current working directory up to the repository root." This is the same path our `AGENTS_FALLBACK.installDir` writes to. So we already serve Codex users by accident — the gap is detection signaling and user-facing labels, not file placement.
2. **Codex's custom slash commands are deprecated**: Per `developers.openai.com/codex/custom-prompts`, the official migration path is "use skills for reusable instructions that Codex can invoke explicitly or implicitly." There is no commands directory to mirror for Codex.

Cursor 1.6 added `.cursor/commands/<name>.md` as a real authored-command surface (per `cursor.com/changelog/1-6` and confirmed via `cursor.com/docs`). We currently install skills for Cursor but skip commands, so Cursor users miss the `tskl` UX Claude users get.

The state machine in `applyInstallPlan` (in `install.ts`) keys on `installDir` for both manifest storage and cleanup lookups. Adding a Codex entry with `installDir = ".agents"` collides with `AGENTS_FALLBACK.installDir = ".agents"` in `findToolByInstallDirectory`. Both routes write the same files to the same place, so there's no actual file conflict — but the lookup function needs to deterministically pick one descriptor when both match.

## Goals / Non-Goals

**Goals:**

- Codex is recognized as a first-class detected tool when `.codex/` is present, with explicit "Codex detected" labels in the install summary instead of the generic fallback messaging.
- Cursor users get our `tskl` slash commands installed alongside skills, matching what Claude users already get.
- Existing detection and install paths for Claude Code, OpenCode, Cursor (skills), and the `.agents/` fallback are preserved exactly.
- The shared `.agents/` install destination between Codex and the fallback resolves to a single deterministic descriptor for state-based cleanup.

**Non-Goals:**

- Codex subagents (`.codex/agents/*.toml`) — different format and surface, separate authoring model.
- Codex plugins packaging (`.codex-plugin/plugin.json`) — distribution layer above skills.
- Cursor rules (`.cursor/rules/`) — we don't ship rules content.
- Global install paths (`~/.codex/skills/`, `~/.cursor/skills/`) — repo-local only, consistent with existing behavior.
- Resurrecting deprecated `~/.codex/prompts/`.
- Reframing the `AGENTS_FALLBACK` as a non-fallback "always install" path. It stays a fallback; Codex detection is what triggers explicit messaging.
- Invoking the Codex CLI as part of automated tests. Verification is by file-placement assertions in `vitest`; the actual "Codex loads our skill" check is a one-time manual step in `tasks.md`.

## Decisions

### Decision 1: Detect Codex via `.codex/` directory or `.codex/config.toml`, not AGENTS.md

`.codex/` is the deterministic Codex-owned directory; presence is a strong signal the user has set Codex up locally. `.codex/config.toml` is added as a secondary file signal for users who only have a config file but no other Codex artifacts yet.

We considered `AGENTS.md` (analogous to `CLAUDE.md`) but rejected it: per the Codex AGENTS.md docs, it's a generic context file that "doesn't necessarily signal Codex setup — these files are optional configuration layers." Treating AGENTS.md as a Codex signal would over-trigger on repos that adopted the convention without using Codex.

### Decision 2: Install Codex skills to `.agents/skills/`, not `.codex/skills/`

Codex's documented read path is `.agents/skills/`, not `.codex/skills/`. Some other tools (e.g. Cursor, per its own docs) read from `.codex/skills/` as a legacy compatibility path, but Codex itself does not. Writing to `.codex/skills/` would be cargo-cult — files would land somewhere Codex doesn't actually read.

This deliberately uses the same destination as `AGENTS_FALLBACK`. The two routes (Codex tool entry vs. fallback) serve different user-facing semantics but produce identical file output, which is correct: `.agents/skills/` is a published cross-tool convention.

### Decision 3: Disambiguate `findToolByInstallDirectory` by preferring registered tools over the fallback

`ALL_KNOWN_TOOLS` today is `[...TOOLS, AGENTS_FALLBACK]`. With Codex added to `TOOLS` with `installDir = ".agents"`, `findToolByInstallDirectory(".agents")` would match Codex first (since it appears earlier in the array) — which is the behavior we want, but it's incidental to array order.

Make this explicit: keep the `[...TOOLS, AGENTS_FALLBACK]` ordering and document it in a code comment. The `find()` returns the first match, so `TOOLS` entries always win over `AGENTS_FALLBACK` for the same `installDir`. No behavior change for Claude/OpenCode/Cursor; deterministic resolution for the new `.agents` collision.

Alternative considered: filter the fallback out of `ALL_KNOWN_TOOLS` entirely once Codex exists. Rejected because the fallback can still be the "tool of record" in a previous install state for users who installed before Codex detection existed — we need it in the lookup to clean up those manifests correctly.

### Decision 4: Cursor's commands path is `commands/tskl/`, mirroring Claude Code

Claude Code uses `commands/tskl/` to namespace our slash commands (so they appear as `/tskl:check`, `/tskl:improve`, etc.). Cursor's slash command system also uses subdirectories as namespaces per Cursor's docs. Using `commands/tskl/` keeps the embedded source layout (`commands/tskl/*.md`) identical for both tools, and the on-disk result mirrors what Claude users see.

Alternative considered: write Cursor commands to `.cursor/commands/` flat (no `tskl/` subdirectory). Rejected because it would namespace-collide with any other tool installing commands directly into `.cursor/commands/` and obscure provenance.

### Decision 5: No automated end-to-end test that invokes Codex

Existing `vitest` tests in `packages/cli/test/install.test.ts` use `mkdtemp` + real fs writes to verify our half of the install contract. New scenarios extend this same pattern. Actually launching `codex` to confirm skill loading is a one-time manual verification step, captured as a checklist item in `tasks.md`.

Rationale: spinning up Codex in CI would require auth, network, and a non-trivial harness; the value (detecting if Codex changes its skill loader) is much smaller than the cost. Detection is by file convention; if we write the right file in the right place with the right frontmatter, Codex's documented behavior covers the rest.

## Risks / Trade-offs

- **Risk**: `.codex/` presence may not always indicate active Codex use (e.g., a stale directory from a removed install) → Mitigation: same risk applies to all our directory-based signals (`.claude/`, `.cursor/`, `.opencode/`); we accept the false-positive trade-off because the install is non-destructive (writes a single skill subdirectory under a clearly-namespaced path).
- **Risk**: Cursor commands written to `.cursor/commands/tskl/` may conflict with a user's hand-authored `tskl` command → Mitigation: same risk pattern as Claude Code today; the prior install manifest tracks what we wrote so re-install/uninstall only touches recorded files.
- **Risk**: Future Codex changes the read path away from `.agents/skills/` → Mitigation: a single line in the `TOOLS` registry adjusts the install destination; no architectural change required. The `.agents/` fallback semantics remain valid even if Codex moves.
- **Trade-off**: Codex and the fallback share `.agents/` — slightly confusing semantics in the manifest (`.agents` is keyed once but means different things to different users) → Accepted because file output is identical and the install summary disambiguates user-facing meaning.

## Migration Plan

No data migration. The change is additive to detection and to the per-tool registry. Users with existing installs:

- A user with `.codex/` who previously got the fallback install will, on next `taskless init`, see "Codex detected" instead of "no tools detected, installing fallback." Files don't move — `.agents/skills/` is still where they live.
- A user with `.cursor/` who previously got skills only will see commands appear in `.cursor/commands/tskl/` after the next `init`. The wizard's diff summary will list the additions. No existing files are touched.

Rollback: revert the `TOOLS` registry change. No state migration needed; the manifest format is unchanged.

## Open Questions

None. Detection signals, install paths, command paths, and verification approach were resolved during exploration.
