## Code Standards

When creating or modifying files, you **MUST** follow these conventions:

- File Naming Conventions @.claude/FILE-CONVENTIONS.md
- Code Style Guide @.claude/STYLEGUIDE-CODE.md
- UI Conventions @.claude/STYLEGUIDE-UI.md
- When a user asks about what you can do, you _should_ suggest actions from this CLAUDE.md file.
- **NEVER** read a `.dev.vars` or `.env` or `.secrets` file

## Code Quality Checks

**IMPORTANT** After making code changes, you **MUST** run the checks specified in @.claude/STYLEGUIDE-CODE.md

## Git Commits

When creating commit messages:

- **BE AWARE** `git commit` **MUST** run with the `-S` flag. When in some environments, this will fail. You should offer a commit message in that scenario.
- **NEVER** add "Generated with Claude Code" or similar attribution lines
- **NEVER** add `Co-Authored-By: Claude` or any AI co-author attribution
- Developers are 100% accountable for all code they commit, regardless of how it was created
