## Code Standards

When creating or modifying files, you **MUST** follow these conventions:

- File Naming Conventions @.claude/FILE-CONVENTIONS.md
- Code Style Guide @.claude/STYLEGUIDE-CODE.md
- UI Conventions @.claude/STYLEGUIDE-UI.md
- When a user asks about what you can do, you _should_ suggest actions from this CLAUDE.md file.
- **NEVER** read a `.dev.vars` or `.env` or `.secrets` file

## Code Quality Checks

**IMPORTANT** After making code changes, you **MUST** run the checks specified in @.conventions/STYLEGUIDE-CODE.md

## Local Development

When running Taskless CLI commands in this repo, use `pnpm cli` instead of `pnpm dlx @taskless/cli@latest`. This runs the locally built CLI at `./packages/cli/dist/index.js`.

When running OpenSpec commands in this repo, use `pnpm openspec` instead of a bare `openspec`. The bare command is not on `PATH` here and is blocked by a deny rule.

## Git Command Help for Agents

- **ALWAYS** run `git commit` with the `-S` flag to ensure commits are GPG-signed. If signing fails, prompt the user to run `echo "test" | gpg --sign > /dev/null` to load their GPG signing key, then retry the commit.

- **ALWAYS** prefer local directory paths when running git commands. For example, run `git status` from the repo root instead of `git -C /path/to/repo status`. This ensures that git's context is correct and avoids issues with submodules, worktrees, and nested repositories.

- **ALWAYS** wait for confirmation before committing. After staging changes with `git add`, present a summary and pause for user approval before running the commit. This allows the user to review diffs and catch issues early.

## Stacked PRs with Git Town

This repo uses [Git Town](https://www.git-town.com/) to manage stacked feature branches. Branch protection lives on `main` only (`Validate` required, `strict_up_to_date: true`, 0 required reviews); child branches are unprotected. Follow these practices to land stacks cleanly.

### Landing a stack: merge _down_, then one merge to `main`

Merge each PR **down** into its parent's branch, from the tip to the bottom:

- Merge `#tip` into its parent's branch, then that into the next parent, … down to the bottom branch (which targets `main`). The bottom branch accumulates the whole stack.
- Bring the bottom branch up to date with `main`, let `Validate` pass, then do the **single** protected merge to `main`.
- Result: one CI cycle instead of N, and every PR gets a real **Merged** badge (not "closed/absorbed").

### Never `--delete-branch` mid-stack

`gh pr merge <n> --delete-branch` on a stacked PR **closes the child** PR (its base branch vanishes) instead of retargeting it. Leave branches in place during the stack; clean them up only after the whole stack has landed.

### Use merge-commit, not squash, for a stack

Stacked branches share commits (each child contains its ancestors). Prefer explicit `gh pr merge --merge` — `--merge` keeps children clean, while squash rewrites the parent into a new commit the children don't have, forcing a `git town sync` reconciliation between every merge and inviting phantom conflicts. (Note: `git town ship`'s default strategy can be squash — avoid it for stacks.)

### Recovery if a child PR gets closed by base-branch deletion

1. Restore the deleted base branch ref at the merge commit's second parent:
   `gh api --method POST repos/<owner>/<repo>/git/refs -f ref=refs/heads/<branch> -f sha=$(git rev-parse origin/main^2)`
2. Reopen the child via **REST** (GraphQL `gh pr reopen` fails on the Projects-classic deprecation):
   `gh api --method PATCH repos/<owner>/<repo>/pulls/<n> -f state=open`
3. Retarget it: `gh pr edit <n> --base main` (only works once it's open).

### Other gotchas

- **Projects-classic deprecation** breaks several GraphQL-backed `gh` commands (`gh pr reopen`, git-town's `gh` connector updating proposals). Workarounds: REST API for PR state changes; git-town `api` connector (`GITHUB_TOKEN`) for proposals.
- **`gh pr update-branch` may not exist** in the installed `gh`; update locally (`git merge origin/main` on the up-to-date remote branch) and push.
- **Stack-aware OpenSpec archive check** (`pr-check-openspec.yml`) skips on non-tip PRs and runs on the tip; "tip" recomputes as branches merge, so it lands green when the archiving PR reaches `main`.
- **`git town sync --all`** propagates fixes up the stack and prunes; run it after the stack lands to clean local branches.

## OpenSpec Apply

When implementing changes via `/opsx:apply`, **pause after each task group** for user review before continuing. Commit between groups and wait for confirmation.
