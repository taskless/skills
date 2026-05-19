## Why

The install engine already removes Taskless stubs from any tool directory dropped from the install plan, but the wizard's tool-selection step pre-checks entries from **tool detection** alone — not from where Taskless is actually installed. A user who wants to consolidate onto `.agents/` and drop the `.claude/` and `.cursor/` shims has no way to "uncheck" those locations, because the manifest's record of them never reaches the multiselect's pre-checked state.

## What Changes

- The wizard's tool-selection step SHALL pre-check the **union of** directories recorded in the install manifest (`install.targets`, excluding the canonical `.taskless/` store) **and** detected tool directories — so a location Taskless already installed into shows checked and can be unchecked.
- Each multiselect entry SHALL carry a three-state hint reflecting its origin: `installed` (in the manifest), `detected` (tool present, not yet installed), or `not detected`.
- Unchecking a manifest-recorded location SHALL remove Taskless's reference stubs from that directory on the next install, via the existing manifest-diff removal path — no new removal engine.
- The removal confirmation in the wizard summary SHALL be itemized per target (e.g. "Remove Taskless from `.claude/` (2 stubs), `.cursor/` (2 stubs)?") instead of the current generic single-line prompt.
- The at-least-one-tool selection rule is unchanged; full uninstall (removing the canonical `.taskless/` store) is explicitly out of scope.
- Empty-directory pruning is out of scope: only the stub files Taskless wrote are removed; `skills/` and `commands/tskl/` directory shells are left in place (current behavior).
- The non-interactive `init --no-interactive` / `update` paths are unchanged: they remain detection-driven, additive, and never surprise-delete a still-present tool's stubs.

## Capabilities

### New Capabilities

<!-- None — this modifies existing wizard behavior. -->

### Modified Capabilities

- `cli-init`: The "Wizard prompts the user to choose install locations" requirement changes — the pre-checked set becomes the union of manifest-recorded and detected directories, with a three-state per-entry hint. The "Wizard shows a diff-style summary before writing" requirement changes — the removal confirmation becomes itemized per target.

## Impact

- `packages/cli/src/wizard/steps/locations.ts` — `locationChoices` gains a manifest-targets parameter (kept pure); `promptLocations` reads install state and passes both manifest targets and detected tools down.
- `packages/cli/src/wizard/steps/summary.ts` — `renderSummaryAndConfirm` builds an itemized per-target removal confirmation message.
- `packages/cli/src/install/install.ts` / `state.ts` — read-only consumption of existing `readInstallState`; no removal-engine changes.
- Tests: `locationChoices` mapping unit tests extended for manifest-driven pre-check and the three-state hint; summary-confirmation copy assertions updated.
- No changes to the non-interactive install path, the manifest schema, or the canonical-store handling.
