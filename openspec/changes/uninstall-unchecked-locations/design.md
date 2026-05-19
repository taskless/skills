## Context

Taskless installs the consolidated `taskless` skill once into a canonical `.taskless/` store, then writes thin reference stubs into each selected tool directory (`.claude/`, `.cursor/`, `.opencode/`, `.agents/`). The install manifest at `.taskless/taskless.json` records, per target, what was written.

`applyInstallPlan` already performs manifest-driven, target-scoped removal: any target present in the previous manifest but absent from the current plan produces an all-removals diff entry, and the apply loop `rm`s those stub files. `renderSummaryAndConfirm` already gates any diff with removals behind a `confirm()`.

The gap is purely in the wizard's selection step. `locationChoices(detected)` derives the multiselect's pre-checked set (`initialValues`) from `detectTools()` — filesystem detection of whether a tool is present. Detection answers "where might you want Taskless?"; it does not answer "where is Taskless installed?". That second answer lives only in the manifest. Because the manifest never reaches the multiselect, a location Taskless installed into but that is not independently detected (notably `.agents/`, which has no detection signal of its own) renders unchecked — so it cannot be meaningfully unchecked, and the removal path the engine already supports is unreachable from the UI.

## Goals / Non-Goals

**Goals:**

- Make the wizard's pre-checked tool set reflect where Taskless is actually installed, so unchecking a location is a real, discoverable action.
- Give each multiselect entry an accurate origin hint: `installed`, `detected`, or `not detected`.
- Itemize the removal confirmation per target so the user sees exactly which locations lose Taskless.
- Keep `locationChoices` a pure, unit-testable function.

**Non-Goals:**

- Full uninstall — removing the canonical `.taskless/` store or the manifest. The at-least-one-tool selection rule stays.
- Pruning empty `skills/` or `commands/tskl/` directory shells left after stub removal.
- Any change to the removal engine (`applyInstallPlan`, `computeInstallDiff`) — it already does the work.
- Any change to the non-interactive `init --no-interactive` / `update` paths — they stay detection-driven and additive.

## Decisions

### Pre-checked set = manifest targets ∪ detected tool directories

`locationChoices` gains a second parameter: the directories recorded in the install manifest. `initialValues` becomes the union of (a) manifest target directories that match a `SHIM_TARGETS` entry and (b) detected tool install directories. The canonical `.taskless/` store is filtered out — it is never a `SHIM_TARGETS` entry, so it is naturally excluded.

The existing "`.agents/` when nothing is detected" fallback still applies, but only when **both** inputs are empty (no manifest, no detection) — i.e. a genuine first run.

_Alternative considered:_ pre-check from the manifest alone. Rejected — a first run has no manifest, and a user who adds a new tool after install should still see it offered as `detected`. The union covers both the install case and the discovery case.

### Three-state hint derived from origin

The per-entry hint is computed from set membership:

```
                       in manifest?
                      ┌──────┬──────┐
                      │ yes  │  no  │
        ┌─────────────┼──────┼──────┤
detected│     yes     │ inst │ det  │
   ?    │     no      │ inst │ none │
        └─────────────┴──────┴──────┘
  inst = "installed"   det = "detected"
  none = "not detected"  (".agents/" first-run default keeps its
                          "generic agent skills" hint)
```

"installed" takes precedence over "detected" — if Taskless is there, that is the more relevant fact for an uninstall decision.

### `locationChoices` stays pure

The manifest is read by `promptLocations` (which already does I/O) via the existing `readInstallState`, and the resulting target directory list is passed _into_ `locationChoices` as an argument. `locationChoices` performs no filesystem access. This preserves the property the spec already calls out — the detection-and-manifest-to-choices mapping is fully unit-testable without a TTY or a filesystem fixture.

### Itemized per-target removal confirmation

`renderSummaryAndConfirm` already iterates `diff.entries`. When `diff.hasRemovals`, instead of the generic single-line prompt, it builds the confirmation message from the entries that carry removals — listing each target directory and its removed stub count: e.g. `Remove Taskless from .claude/ (2 stubs), .cursor/ (1 stub)?`. The diff summary block above the prompt is unchanged. No-removal installs still skip the extra confirm.

## Risks / Trade-offs

- **A detected-but-never-installed tool now appears pre-checked as `detected`.** This matches today's behavior (detection already pre-checks), so no regression — the union only ever adds the manifest set on top.
- **Manifest lists a directory no longer in `SHIM_TARGETS`** (e.g. a removed/renamed tool) → it is filtered out of `initialValues` and not offered. The stub, if any, is then neither shown nor removed. Acceptable: out-of-catalog directories are outside this change's scope, and the existing convergence logic is unaffected.
- **User unchecks every previously-installed tool but the at-least-one rule forces one selection** → no full uninstall. This is intended (full uninstall is a Non-Goal); the user keeps at least one stub location plus the canonical store.

## Migration Plan

No data migration. The manifest schema is unchanged — this change only _reads_ `install.targets`. Behavior change is confined to interactive wizard runs; the non-interactive path is byte-for-byte unchanged. Rollback is a straight revert of the wizard files.
