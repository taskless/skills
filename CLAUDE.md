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

## Git Command Help for Agents

- **ALWAYS** run `git commit` with the `-S` flag to ensure commits are GPG-signed. If signing fails, prompt the user to run `echo "test" | gpg --sign > /dev/null` to load their GPG signing key, then retry the commit.

- **ALWAYS** prefer local directory paths when running git commands. For example, run `git status` from the repo root instead of `git -C /path/to/repo status`. This ensures that git's context is correct and avoids issues with submodules, worktrees, and nested repositories.

- **ALWAYS** wait for confirmation before committing. After staging changes with `git add`, present a summary and pause for user approval before running the commit. This allows the user to review diffs and catch issues early.

## OpenSpec Apply

When implementing changes via `/opsx:apply`, **pause after each task group** for user review before continuing. Commit between groups and wait for confirmation.
