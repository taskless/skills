## 1. Signature module

- [x] 1.1 Create `packages/cli/src/rules/rule-hash.ts` exporting `ALGO_VERSION`, `normalize(text)`, `canonicalHash(input)` (returns the `1;h=sha-256;d=<hex>` envelope), and `parseSignature(sig)` (validates the envelope, reads algoVersion up to the first `;`).
- [x] 1.2 Implement `normalize()` exactly: UTF-8 decode, strip one leading `U+FEFF` BOM, convert CRLF and lone CR to LF, strip all trailing newlines then append one LF. No YAML parsing, no Unicode NFC/NFD.
- [x] 1.3 Hash with web-standard APIs only: `crypto.subtle.digest('SHA-256', …)` + `TextEncoder`; do NOT import `node:crypto`. Hex-encode lowercase.
- [x] 1.4 Add a helper to read a rule file as UTF-8 and produce its signature (used by reconcile and any sidecar write).

## 2. Conformance vectors

- [x] 2.1 Add a fetch script (mirroring `scripts/fetch-ast-grep-schema.ts`) that pulls `GET /cli/api/rule-hash-vectors`, unwraps `{ vectors }`, re-escapes to pure ASCII, and writes `packages/cli/test/fixtures/rule-hash.vectors.json`; wire the `generate:rule-hash-vectors` npm script AND a `prebuild` hook that always tries the network but falls back to the committed cache (only a missing cache is fatal).
- [x] 2.2 Commit the vectors fixture (cross-repo source-of-truth bare-array format).
- [x] 2.3 Add `packages/cli/test/rule-hash.test.ts` that parses each vector's `input` as JSON (decoding `\uXXXX`) and asserts `canonicalHash(input) === signature` for every entry; failure blocks the build.
- [x] 2.4 Add focused unit tests for each invariant: CRLF-equals-LF, lone-CR, trailing-newlines-collapse, empty→single-LF, BOM-stripped (leading/double/interior), content-change-differs, multibyte UTF-8, combining-mark-not-NFC-folded.

## 3. Reconcile API client

- [x] 3.1 Create `packages/cli/src/api/reconcile.ts` with local `ReconcileRequest` (`{ repositoryUrl, files: { file, signature }[] }`) and `ReconcileResponse` (`run`/`unsafe`/`unknown`/`missing`) types.
- [x] 3.2 Implement `reconcile(token, request)` issuing `POST /cli/api/reconcile` with `Authorization: Bearer <token>` against `getApiBaseUrl()`'s origin (plain fetch, since the path is not in the generated schema).
- [x] 3.3 Map outcomes to a discriminated `ReconcileOutcome`: success → parsed buckets (`ok`); `401` → `unauthorized`; transport error / `404` / not-deployed / any other non-2xx → `unavailable` (never a thrown hard failure that aborts `check`). Verified against the live origin: reconcile returns 405 (not yet deployed) → `unavailable`.
- [x] 3.4 Add `RECONCILE_FAILED` to the `CLIErrorCode` union in `packages/cli/src/types/errors.ts`.

## 4. Run-set gating in check

- [x] 4.1 Add a rule-enumeration + signing step (`src/rules/run-set.ts` → `signRuleFiles`): read every `.yml` under `.taskless/rules/`, compute `{ file, path, signature }` for each.
- [x] 4.2 In `packages/cli/src/commands/check.ts` (`resolveScanMode`), branch on auth state: no token (or `--anonymous`) → local; token + resolvable `repositoryUrl` + not `--anonymous` → reconcile, gating to the `run` set on `ok`.
- [x] 4.3 Materialize an ephemeral, gitignored `.taskless/.run/rules/` (`materializeRunDirectory` + `selectRunFiles`) containing only the `run`-set files matched by signature; `.taskless/.gitignore` gets `.run/`.
- [x] 4.4 Extend `src/filesystem/sgconfig.ts` to accept a target rules directory and point `ruleDirs` at the ephemeral run dir; scan via the existing `runAstGrepScan`.
- [x] 4.5 When the `run` set is empty, skip `sg scan`, produce zero results, and exit 0 (still surface advisories).

## 5. Mismatch warnings, degrade & exit codes

- [x] 5.1 On a successful authenticated reconcile, `surfaceReconcileWarnings` warns on `unsafe` (tamper/drift), `unknown` (not server-issued), and `missing` (audit-only) without changing the exit code.
- [x] 5.2 The unauthenticated/`--anonymous` path is silent (runs all local rules, no warning).
- [x] 5.3 The authed degrade path warns and scans all local rules with no non-zero exit — covers no git remote, `unauthorized` (401, with a re-auth hint), and `unavailable` (unreachable / not-deployed / transport).
- [x] 5.4 All warnings/notices are suppressed under `--json` (warnings go to stderr and are gated on `!args.json`); the existing `{ success, results }` / error-envelope shapes are unchanged.
- [x] 5.5 The exit code stays governed solely by error-severity results from the executed rule set.

## 6. Help & docs

- [x] 6.1 Update `packages/cli/src/help/check.txt` with a "What runs (auth state)" section (offline/`--anonymous` runs local; authed reconciles and warns on `unsafe`/`unknown`/`missing`; warnings are stderr-only and never affect exit code or `--json`).
- [x] 6.2 Update `packages/cli/src/help/ci.txt` step 7 to describe the optional `TASKLESS_TOKEN` backstop as the enforcement point over the reconciled run set.

## 7. Tests & verification

- [x] 7.1 Add reconcile-gating integration tests (vitest, subprocess against `dist/`, temp-dir fixtures with a mock reconcile server + git origin): only `run`-set rules scanned; non-run files excluded. Also unit tests for `signRuleFiles`/`selectRunFiles`/`materializeRunDirectory` in `test/run-set.test.ts`.
- [x] 7.2 Add auth-state tests: logged-out and `--anonymous` scan all rules silently (no reconcile call); authed endpoint-unavailable (503) warns and degrades without failing the exit code; `--json` omits warnings.
- [x] 7.3 Add mismatch-warning tests: `unsafe`/`unknown`/`missing` warn without changing the exit code; empty run set exits 0 without invoking the scanner.
- [x] 7.4 Ran `pnpm typecheck`, `pnpm lint`, and the full `pnpm test` (turbo build + 340 tests) — all green.
