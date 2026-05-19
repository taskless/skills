## 1. Manifest-aware location choices

- [x] 1.1 Extend `locationChoices` in `packages/cli/src/wizard/steps/locations.ts` to accept a second argument: the list of install-manifest target directories. Keep the function pure (no filesystem access).
- [x] 1.2 Compute `initialValues` as the union of manifest target directories matching a `SHIM_TARGETS` entry and detected tools' install directories; keep the `.agents/` first-run default only when both inputs are empty.
- [x] 1.3 Compute each entry's hint with `installed` (in manifest) taking precedence over `detected`, falling back to `not detected`, preserving the `.agents/` "generic agent skills" default-hint case.
- [x] 1.4 Update `promptLocations` to read install state via `readInstallState`, derive the manifest target directory list (excluding `.taskless/`), and pass it into `locationChoices`.

## 2. Itemized removal confirmation

- [x] 2.1 In `packages/cli/src/wizard/steps/summary.ts`, build the removal confirmation message from `diff.entries` that carry removals — naming each target directory and its removed stub count.
- [x] 2.2 Keep the diff summary block and the no-removal fast-path (`!diff.hasRemovals` returns `true`) unchanged.

## 3. Tests

- [x] 3.1 Extend the `locationChoices` unit tests: manifest-only pre-check, manifest ∪ detected union, `installed`-over-`detected` precedence, and the both-empty `.agents/` default.
- [x] 3.2 Add a test that an entry recorded in the manifest carries the `installed` hint and `.taskless/` is never an offered or pre-checked entry.
- [x] 3.3 Update summary-confirmation tests to assert the itemized per-target message (target names and stub counts) and that no-removal summaries skip the confirm. Added end-to-end uninstall tests in `wizard-integration.test.ts` covering stub removal on uncheck and decline-keeps-stubs.

## 4. Verification

- [x] 4.1 Run `pnpm typecheck` and `pnpm lint`; fix any failures.
- [x] 4.2 Run the CLI test suite (`pnpm --filter @taskless/cli test`) and confirm all tests pass.
