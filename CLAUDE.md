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

## Git Commits

When creating commit messages:

- **BE AWARE** `git commit` **MUST** run with the `-S` flag. When in some environments, this will fail. You should offer a commit message in that scenario.
- **GPG Signing Workaround:** If signing fails due to no TTY available, prompt the user to run `echo "test" | gpg --sign > /dev/null` to load the GPG signing key, then retry the commit.
- **NEVER** add "Generated with Claude Code" or similar attribution lines
- **NEVER** add `Co-Authored-By: Claude` or any AI co-author attribution
- Developers are 100% accountable for all code they commit, regardless of how it was created
