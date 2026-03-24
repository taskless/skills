## Context

The repo is a pnpm monorepo with turbo orchestration. Currently there is one package (`packages/cli`) using vitest for tests and tsc for type checking. ESLint runs from the root. There are no GitHub Actions workflows — all validation is manual.

The turbo pipeline defines `test` as depending on `build`, so `turbo run test` already handles the build-then-test ordering. `lint` and `typecheck` have no dependencies and can run independently.

## Goals / Non-Goals

**Goals:**

- Automated validation on every PR to `main` and every push to `main`
- Run all four checks: lint, typecheck, build, test
- Keep the workflow simple and fast to iterate on

**Non-Goals:**

- Publishing or release automation (stays manual via `pnpm release:production`)
- Dependency caching (can be added later)
- Node version matrix (single version for now)
- Turbo remote caching
- Branch protection rules (separate concern, can reference this workflow later)

## Decisions

**Single workflow file with sequential steps vs. parallel jobs**

Using a single job with sequential steps. The checks are fast for a single package and the overhead of spinning up multiple runners outweighs parallelism gains at this scale. When the repo grows, this can be split into parallel jobs.

_Alternative: separate jobs for lint/typecheck/build/test with a dependency graph. Rejected for now — adds complexity without meaningful speed improvement for one package._

**pnpm via corepack**

Use `pnpm/action-setup` to install pnpm matching the `packageManager` field in `package.json`. This keeps CI and local dev on the same pnpm version automatically.

**Node version**

Pin to Node 22 (current LTS). The `packageManager` field already pins pnpm, so we only need to choose Node.

_Alternative: Node 20. Still supported but 22 is current LTS and matches likely local dev environments._

**turbo for orchestration**

Run `pnpm lint` and `pnpm typecheck` directly, then `pnpm test` which goes through turbo (which handles the build dependency). No need to call `pnpm build` separately since turbo's `test` task already depends on `build`.

_Correction: run `pnpm build` explicitly before `pnpm test` for clarity, since the workflow should make the build step visible in logs even though turbo would handle it. This also means build failures surface as a distinct step._

## Risks / Trade-offs

**[No caching]** → CI will install all dependencies from scratch every run. Acceptable for now; adding `actions/cache` or pnpm store caching is a straightforward follow-up.

**[Single Node version]** → Won't catch version-specific issues. Mitigated by using current LTS. Matrix can be added later.

**[No branch protection]** → CI runs but doesn't block merge. This is intentional — branch protection is a repo settings concern, not a workflow concern.
