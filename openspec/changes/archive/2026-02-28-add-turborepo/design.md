## Context

This is a pnpm monorepo with one package (`packages/cli`) and root-level tooling. Currently, running tasks across the workspace requires explicit `--filter` flags (e.g., `pnpm --filter @taskless/cli build`). Root scripts only cover root-level concerns (`lint`, `lint:fix`, `prepare`). As packages grow, we need a task runner that understands dependency order and caches results.

## Goals / Non-Goals

**Goals:**

- Root-level commands (`pnpm build`, `pnpm test`, `pnpm typecheck`) that run across all workspace packages
- Turborepo caching for build and test outputs
- Task dependency graph so `test` can depend on `build`
- Keep individual package scripts unchanged — Turborepo wraps them

**Non-Goals:**

- Remote caching (can be added later)
- CI pipeline configuration (separate concern)
- Changing how packages define their own scripts

## Decisions

### Turborepo over Nx or custom scripts

Turborepo is lightweight, zero-config for basic setups, and integrates natively with pnpm workspaces. It reads `package.json` scripts directly — no plugin system needed.

**Alternative considered:** Nx. More powerful but heavier, opinionated project graph, and unnecessary for a repo this size. Also considered plain `pnpm -r run`, but it lacks caching and doesn't understand task dependencies.

### Root scripts delegate to turbo

Root `package.json` scripts like `build`, `test`, and `typecheck` will invoke `turbo run <task>`. This means `pnpm build` at root runs builds across all packages.

Existing root-only scripts (`lint`, `lint:fix`, `prepare`) stay as-is — they operate on the root, not per-package.

### Cache configuration

- `build` outputs: cache `dist/**` — deterministic from source
- `test` outputs: no file output, but exit code is cached
- `typecheck` outputs: no file output, exit code cached
- `lint`: not run through turbo (root-level eslint already covers all packages via glob patterns)

### Lint stays root-level

ESLint is configured at the root with `projectService: true` and `tsconfigRootDir`, which already lints all packages. Running lint through turbo per-package would require per-package eslint configs. Not worth the complexity.

## Risks / Trade-offs

- **turbo.json maintenance**: Adding a new package requires no turbo config changes as long as it uses standard script names (`build`, `test`, `typecheck`). → Low maintenance burden.
- **Cache invalidation**: Turborepo hashes inputs (source files, dependencies, env) automatically. If caching produces stale results, `turbo run <task> --force` bypasses it. → Acceptable escape hatch.
