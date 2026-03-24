## Why

There is no automated validation on pull requests or the main branch. Lint, type checking, build, and test failures can land undetected. A GitHub Actions CI workflow will catch regressions before merge and ensure main stays green.

## What Changes

- Add a GitHub Actions workflow that runs on PRs targeting `main` and on pushes to `main`
- The workflow runs the existing validation commands: `lint`, `typecheck`, `build`, and `test`
- Validation only — no publishing or release automation

## Capabilities

### New Capabilities

- `ci`: GitHub Actions CI workflow configuration, triggers, and validation jobs

### Modified Capabilities

_None. Existing build-tooling scripts are consumed as-is._

## Impact

- New file: `.github/workflows/ci.yml`
- No changes to existing packages, scripts, or dependencies
- Enables future branch protection rules requiring CI to pass before merge
