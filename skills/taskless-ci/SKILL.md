---
name: taskless-ci
description: Integrates Taskless into a developer's CI environment. Use when the user wants to set up Taskless in their CI pipeline, wire up automated rule checks on pull requests, or scaffold CI configuration for Taskless. Trigger on "set up CI", "add taskless to CI", "taskless in GitHub Actions", "run taskless on PRs", or "wire up CI for taskless".
metadata:
  author: taskless
  version: 0.5.4
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless CI

When this skill is invoked, help the user wire `taskless check` into their existing CI system so Taskless rules run automatically on pushes and pull requests.

Your goal is to **integrate with what the user already has** — not replace it. Discover the CI they use, agree on an approach, generate a minimal standalone config. Their existing pipelines stay untouched.

This skill teaches two patterns (**full scan** and **diff scan**) that translate to any CI system. Common systems are listed below as hints, but if you recognize a CI system not on that list, apply the same patterns to it — the shape of the job is the same everywhere.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent in generated config: `pnpm dlx`, `yarn dlx` (Yarn Berry/2+ only), or `bunx`.

### 1. Discover the user's CI system

Scan the repo root for CI config files. Common hints (not exhaustive — other CI systems use similar file/dir conventions):

- `.github/workflows/*.yml` — **GitHub Actions**
- `.gitlab-ci.yml` — **GitLab CI**
- `.circleci/config.yml` — **CircleCI**
- `Jenkinsfile` — **Jenkins**
- `azure-pipelines.yml` or `.azure-pipelines.yml` — **Azure Pipelines**
- `bitbucket-pipelines.yml` — **Bitbucket Pipelines**
- `.buildkite/` — **Buildkite**
- `.drone.yml` — **Drone**
- `.travis.yml` — **Travis CI**
- Any other config file in the root that obviously belongs to a CI system you recognize

**Sum up what you found briefly** (e.g., "I see GitHub Actions in `.github/workflows/ci.yml`") and confirm with the user. If zero signals match, ask which CI they use. If multiple match, ask which one should run Taskless — one is usually enough.

### 2. Agree on the scan pattern

There are two building blocks. The generated config uses one, the other, or both:

- **Full scan** — `taskless check`. Scans the entire repo. Simplest. Best for small-to-medium codebases and for runs on the main/default branch (catches anything a diff might miss).
- **Diff scan** — `taskless check <paths>`. Scans only files in the current diff. Faster on large codebases. Best for pull request runs where feedback speed matters.

Compute the diff using whatever the target CI system exposes. Every CI provides a way:

- **GitHub Actions**: `github.base_ref` for PRs, `origin/$GITHUB_BASE_REF...HEAD` as the diff target
- **GitLab CI**: `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` for MRs
- **CircleCI**: `CIRCLE_BRANCH` + a fetched `main` (CircleCI doesn't expose a base ref directly; fetch main and diff against it)
- **Jenkins**: `env.CHANGE_TARGET` for PR builds (multibranch pipeline)
- **Azure Pipelines**: `System.PullRequest.TargetBranch` for PR builds
- **Bitbucket Pipelines**: `BITBUCKET_PR_DESTINATION_BRANCH` for PR builds
- Any other system: look up the user's CI docs for "base branch" / "target branch" — every CI exposes this

Because `taskless check` silently ignores paths that don't exist, you can pipe raw `git diff --name-only` output straight into it without filtering deleted files.

**Recommended default** (offer this unless the user has a reason to override): diff scan on PRs, full scan on pushes to the main/default branch. Catches regressions on main while keeping PR feedback fast.

### 3. Verify `taskless check` works locally before writing CI

**Don't skip this.** A green local check is the cheapest signal the CI config will work. Run:

```
npx @taskless/cli@latest check
```

- Clean pass → proceed.
- `"No rules configured"` → stop and invoke `taskless-create-rule` (or ask the user to create rules first). Wiring CI with no rules produces a CI check that's always green and gives false confidence — a footgun.
- Non-zero with actual matches → tell the user CI will fail on these. Ask if they want to fix, suppress, or set up CI knowing the first run will be red.

### 4. Read current CLI help

```
npx @taskless/cli@latest help check
```

Use this to confirm current flags and usage before embedding them in a config file that will stick around.

### 5. Generate the config

**Rules for generation:**

1. **Write a new, standalone file. Never modify an existing CI file the user owns.** If they regret Taskless, removing one file is easier than unwinding edits to their main pipeline.
2. **Prefer the CI system's native include/import mechanism.** If the CI system supports one, write a standalone snippet and tell the user the single line they need to add to their main config. If it doesn't (Bitbucket, some uses of CircleCI), write the snippet to `.taskless/ci/<filename>` and give the user explicit instructions on where to paste it.
3. **Before writing**, check if the target file already exists. If it does, **ask before overwriting**. Never silently replace their work.

**Canonical path for each CI system:**

- GitHub Actions → `.github/workflows/taskless.yml` (standalone workflow, no include needed)
- GitLab CI → `.taskless/ci/gitlab.yml` (user adds `include: { local: '.taskless/ci/gitlab.yml' }` to their root `.gitlab-ci.yml`)
- CircleCI → `.taskless/ci/circleci-job.yml` (CircleCI doesn't support include; user copies the job + workflow entry into their `.circleci/config.yml`)
- Jenkins → `.taskless/ci/taskless.Jenkinsfile` (user loads via `load()` or copies the `stage` into their Jenkinsfile)
- Azure Pipelines → `.taskless/ci/azure-taskless.yml` (user references via `template:` under a job's `steps:`)
- Bitbucket Pipelines → `.taskless/ci/bitbucket-pipelines.yml` (Bitbucket doesn't support include; user merges into their root `bitbucket-pipelines.yml`)
- Any other CI system: use the same idea — a standalone file under `.taskless/ci/` with whatever `<system>.<ext>` extension is idiomatic, plus clear instructions for wiring it up.

### 6. Config templates (two patterns, everything else is translation)

The template below is **GitHub Actions** — the most common and self-contained case. It demonstrates both the full-scan and diff-scan blocks. For any other CI system, translate the same structure: checkout with full history, set up Node, run the check command conditionally based on whether the build is for a PR or a push.

Substitute `{{PACKAGE_MANAGER_DLX}}` with the user's package manager invocation: `npx @taskless/cli@latest`, `pnpm dlx @taskless/cli@latest`, `yarn dlx @taskless/cli@latest`, or `bunx @taskless/cli@latest`.

**`.github/workflows/taskless.yml`**:

```yaml
name: Taskless

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Taskless check
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            git fetch origin "${{ github.base_ref }}" --depth=1
            FILES=$(git diff --name-only "origin/${{ github.base_ref }}...HEAD")
            if [ -z "$FILES" ]; then
              echo "No changed files."
              exit 0
            fi
            {{PACKAGE_MANAGER_DLX}} check $FILES
          else
            {{PACKAGE_MANAGER_DLX}} check
          fi
```

**Simplifications depending on user choice:**

- User picked full-scan only → drop the `if`, just run `{{PACKAGE_MANAGER_DLX}} check`.
- User picked diff-scan only → remove the `push:` trigger, keep only the PR branch.

**For other CI systems**, emit the equivalent:

1. Set up Node.js (v20 is a safe default; match their existing CI if they use a specific version).
2. Fetch with full depth (or enough depth to reach the target branch — most CIs default to a shallow fetch).
3. Fetch the target branch.
4. Compute changed files with `git diff --name-only "origin/<target>...HEAD"`.
5. Exit early if the diff is empty.
6. Call `{{PACKAGE_MANAGER_DLX}} check $FILES` for PR builds, or `{{PACKAGE_MANAGER_DLX}} check` for main-branch builds.

The exact syntax varies — YAML for GitHub/GitLab/Azure/Bitbucket, Groovy for Jenkins, different job/workflow structure for CircleCI. But the six steps above are universal. If you recognize the user's CI system, emit idiomatic config for it; don't try to retrofit GitHub Actions syntax where it doesn't belong.

### 7. Authentication in CI

`taskless check` does **not** require authentication — it only reads rule files from `.taskless/rules/`. The generated CI config works out of the box with no secrets or environment variables.

Only mention auth if the user explicitly wants to run authenticated commands in CI (e.g., `rules create`, `rules improve`). That's uncommon; for a check-only integration, skip it.

### 8. Package manager caveats

- **pnpm**: CI runners using `pnpm dlx` work but have slower cold starts than `npx`. If the user's main pipeline already installs pnpm (e.g., via `pnpm/action-setup@v4` in GitHub Actions), they may prefer adding `@taskless/cli` as a project dependency and calling it via `pnpm taskless check`.
- **Yarn v1 (classic)**: does not support `yarn dlx`. Use `npx` instead — Yarn v1 ships with npm, so `npx` is available.
- **bun**: `bunx` works fine.

### 9. Report back to the user

After writing, show:

1. The path written and a short excerpt (first 10–15 lines).
2. For CI systems that need manual wiring (anything not GitHub Actions): the exact `include:` / reference line they need to add to their main config.
3. `git status` so they can see the new file before committing.
4. A brief note that the first CI run will exercise the rules — if there are existing red matches, CI will fail until fixed or suppressed.

### 10. Handle errors

- **No rules yet** (`taskless check` says "No rules configured"): invoke `taskless-create-rule`, do NOT write CI config.
- **User's CI system isn't one you recognize**: still help — extract the scan pattern (checkout → fetch base → diff → invoke), and produce a generic shell script under `.taskless/ci/check.sh` that they can wire into whatever system they use. Be upfront that you're providing a starting point, not a finished config.
- **Target CI file already exists** and the user declines overwriting: stop. Tell them what you would have written and let them reconcile manually.
