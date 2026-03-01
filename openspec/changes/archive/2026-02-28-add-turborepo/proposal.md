## Why

As the monorepo grows with more packages, running `lint`, `typecheck`, `build`, and `test` individually per package doesn't scale. Turborepo provides a task runner that understands the package dependency graph, caches outputs, and lets root-level commands like `pnpm turbo lint` walk the entire workspace intelligently.

## What Changes

- Add `turbo` as a root devDependency
- Create `turbo.json` configuration defining task pipelines (`lint`, `typecheck`, `build`, `test`)
- Add root scripts that delegate to `turbo` (e.g., `pnpm build` runs `turbo build` across all packages)
- Configure caching for build and test outputs

## Capabilities

### New Capabilities

- `repo`: Turborepo task runner configuration for orchestrating workspace-wide lint, typecheck, build, and test pipelines with dependency-aware caching

### Modified Capabilities

_None — existing `cli` and `skills` specs are unchanged. This is infrastructure._

## Impact

- **Root `package.json`**: New `turbo` devDependency; root scripts updated to use `turbo`
- **New file**: `turbo.json` at repo root
- **No changes to packages**: Individual package scripts (`build`, `typecheck`, `test`) remain as-is; Turborepo wraps them
