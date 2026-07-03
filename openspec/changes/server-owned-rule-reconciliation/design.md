## Context

`taskless check` today (`packages/cli/src/commands/check.ts`) enumerates every `*.yml` under
`.taskless/rules/`, writes a fixed `.taskless/sgconfig.yml` with `ruleDirs: [rules]`
(`src/filesystem/sgconfig.ts`), and shells out to `sg scan` (`src/rules/scan.ts`). It has no
notion of authenticity, no signing, no network call, and no auth dependency — `--anonymous`
is a pure no-op. There is no rule-hash code, no conformance harness, and the generated API
schema (`src/generated/api.d.ts`) exposes only `whoami` / `rule` / `rule/{id}` /
`rule/{id}/iterate`. Reconciliation is entirely greenfield.

The backend (TSKL-270) is introducing `POST /cli/api/reconcile`: the CLI reports the rule
files it holds as `{ file, signature }`, and the server returns the exact subset that may run.
The signature format, the `normalize()` procedure, and the conformance vectors are **frozen**
and specified in `tmp/rule-signatures.md`; the endpoint may not be live in every environment
on day one. The existing plumbing we build on: `resolveIdentity(cwd)` →
`{ token, orgId, repositoryUrl }` (`src/auth/identity.ts`), `getToken(cwd)`
(`src/auth/token.ts`), the `openapi-fetch` client + base-URL resolution
(`src/api/client.ts`, `src/api/config.ts`), and the stable error envelope
(`src/types/errors.ts`).

## Goals / Non-Goals

**Goals:**

- A signature module that reproduces the server's `rule-hash.ts` byte-for-byte, verified by
  the shared conformance vectors.
- A reconcile client for `POST /cli/api/reconcile` returning typed `run`/`unsafe`/`unknown`/
  `missing` buckets.
- `check` executes only the `run` set (matched by signature) when it can reconcile, and
  surfaces the other buckets as advisory.
- A fallback that keeps `check` working offline / logged-out / `--anonymous` / before the
  endpoint ships, preserving today's linter posture.

**Non-Goals:**

- Defining or implementing how a **server-owned/runtime rule executes**. The reconciliation
  contract is rule-type-agnostic (it gates which files run). Rule execution is a deliberate,
  team-owned follow-up shipped as a **separate proposal stacked on top of this change**; this
  change only makes such rules gate-able.
- A `sync` / `pull` / `list` command to bulk-download rules (none exists today; reconciliation
  does not require one — the CLI reports what is already on disk).
- Server-side approval of `unknown` files (explicitly server-side future work).
- Changing the on-disk rule naming scheme. The reconcile join key is the signature, not the
  path, so `<id>.yml` naming is fine as-is.

## Decisions

### Decision: New `rule-hash.ts` mirroring the server, web-standard crypto only

Add `packages/cli/src/rules/rule-hash.ts` exporting `ALGO_VERSION`, `normalize(text)`,
`canonicalHash(bytes|text)` (returns the envelope string), and `parseSignature(sig)`. Use
`crypto.subtle.digest('SHA-256', …)` + `TextEncoder` exclusively — no `node:crypto`. This
matches the server reference (`packages/shared/src/rule-hash.ts`) and runs identically in
workerd and Node 20+. `normalize()` operates on raw decoded text (BOM strip, CRLF/CR→LF,
collapse trailing newlines to one LF) and never parses YAML, so it is future-proof for any
rule type.

_Alternative rejected:_ `node:crypto` `createHash`. Simpler locally but diverges from the
web-standard reference the server pins, and risks subtle cross-repo drift the vectors exist to
prevent.

### Decision: Conformance test fetches vectors, commits a fixture, asserts exact reproduction

Add a script/step to fetch `GET /cli/api/rule-hash-vectors` and commit the result as
`packages/cli/test/fixtures/rule-hash-vectors.json`, plus a vitest test
(`test/rule-hash.test.ts`) that parses each `input` as JSON (decoding `\uXXXX`) and asserts
`canonicalHash(input) === signature`. A mismatch fails the build. Committing the fixture (vs.
fetching at test time) keeps tests hermetic/offline; refresh is a manual step when the algo
version bumps, mirroring `generate:ast-grep-schema`.

_Alternative rejected:_ fetch vectors live during the test run — introduces network flakiness
into CI and couples the unit suite to endpoint availability.

### Decision: Reconcile client via a hand-typed request over the existing fetch layer

The reconcile endpoint is not in the generated `paths`, and the handoff says it may not be
deployed everywhere yet. Add `packages/cli/src/api/reconcile.ts` exporting
`reconcile(token, { repositoryUrl, files })`. Reuse `createApiClient(token)` where possible;
because the path is absent from the generated schema, type the request/response with local
interfaces (`ReconcileRequest`, `ReconcileResponse` with `run`/`unsafe`/`unknown`/`missing`)
and issue the call with an explicit `Authorization: Bearer` header against `getApiBaseUrl()`'s
origin. Map a `401` to an unauthorized signal and any transport/`404`/not-deployed outcome to
a distinct "reconcile unavailable" signal that drives the fallback (never a hard failure).
When the endpoint lands in the published schema, this can be migrated onto the typed client
without changing `check`.

_Alternative rejected:_ add the path to `api.d.ts` by hand — the file is generated
(`pnpm generate:api`) and hand-edits would be clobbered; wait for the server schema to expose
it, then regenerate.

### Decision: Gate the scan by materializing a run-set rule directory

`sg scan` selects rules via `ruleDirs` in `sgconfig.yml`, so limiting execution to the `run`
set means pointing ast-grep at only those files. Materialize an ephemeral, gitignored
`.taskless/.run/rules/` containing just the blessed files (copied from their local matches by
signature), generate an sgconfig whose `ruleDirs` points there, and scan that. Keeps
`src/rules/scan.ts` unchanged (it already accepts a config path and positional paths) and
avoids mutating the user's `.taskless/rules/`. On fallback, generate the current sgconfig
(`ruleDirs: [rules]`) and scan everything, exactly as today.

_Alternatives considered:_ (a) delete non-run files in place — destructive, unacceptable;
(b) pass each blessed rule as an inline `--rule` arg — brittle across ast-grep versions and
loses `testConfigs`. The ephemeral-dir approach is the least invasive and reuses existing
config generation.

### Decision: Auth state is the behavior axis; degrade (not fail) when authed reconcile can't complete

`check` requires no auth and picks its path from auth state:

- **No token** (or `--anonymous`) → run all local rules with no network. This is the normal
  offline linter posture, so it emits no warning (an informational line is optional).
- **Authenticated** (token + resolvable `repositoryUrl`, `--anonymous` unset) → reconcile,
  run only the `run` set, and **warn** on `unsafe`/`unknown`/`missing` mismatches.
- **Authenticated but reconcile can't complete** (no git remote, endpoint unreachable /
  not-deployed, transport error) → **degrade**: warn that verification couldn't be performed
  and scan all local rules, without a non-zero exit.

All warnings are human-output only and suppressed under `--json` to keep the machine shape
stable. This honors the handoff's trust model — local `check` stays advisory like a linter,
the server-owned allow-list applies when authenticated, and the paid-plan CI backstop is the
real enforcement point — and prevents the not-yet-live endpoint from bricking `check`.
Separating "no auth" (silent, expected) from "authed-but-couldn't-verify" (warned) keeps
routine offline use quiet while still flagging a genuine verification gap.

### Decision: Add `RECONCILE_FAILED` to the error enum, used sparingly

Extend `CLIErrorCode` in `src/types/errors.ts` with `RECONCILE_FAILED`. Because reconcile
failure normally triggers the fallback (not an error), this code is reserved for the case
where reconciliation itself is the requested operation and hard-fails in a way the user asked
to be surfaced. Adding a code is permitted by the `cli` capability without a major bump.

## Risks / Trade-offs

- **[Endpoint not deployed on day one]** → Fallback treats unreachable/404 as "reconcile
  unavailable" and scans locally; no behavior regression versus today until the endpoint
  ships.
- **[Signature drift from the server reference]** → Committed conformance vectors + a
  build-blocking test catch any divergence in `normalize()`/hashing before release.
- **[`check` gains a network + auth dependency]** → Reconciliation is strictly additive and
  gated; unauthenticated and `--anonymous` runs keep working with no auth via the fallback.
- **[Ephemeral run-dir leaks into git]** → Write under `.taskless/.run/` and ensure
  `.taskless/.gitignore` covers it (same mechanism that hides `sgconfig.yml`); regenerate on
  every run.
- **[Users read the fallback as "verified"]** → The one-line notice explicitly states rules
  are unverified and names the CI backstop as the enforcement point.
- **[Reconcile latency on large corpora]** → One request per `check`; signatures are cheap
  SHA-256 over small files. Acceptable; can batch/cache later if needed.

## Open Questions

- **Warning verbosity**: how loudly to warn on `unknown`/`missing` in human output (always,
  or behind a `--verbose`/`--strict` flag) — resolve during implementation against the help
  copy for `check`/`ci`. `unsafe` (tamper/drift) should warn by default.
- **CI `--strict` mode**: whether the CI backstop invocation should turn `unsafe` into a
  non-zero exit (the enforcement posture) versus advisory locally. Defer unless the backstop
  spec requires it here.
