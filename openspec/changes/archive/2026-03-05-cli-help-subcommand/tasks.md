## 1. Help text files

- [x] 1.1 Create `packages/cli/src/help/` directory with help text files for all commands: `check.txt`, `init.txt`, `info.txt`, `auth.txt`, `auth-login.txt`, `auth-logout.txt`, `rules.txt`, `rules-create.txt`, `rules-delete.txt`

## 2. Help command implementation

- [x] 2.1 Create `packages/cli/src/commands/help.ts` with a `helpCommand` that embeds help files via `import.meta.glob`, resolves positional args to a help file key, and prints the content or an error for unknown commands
- [x] 2.2 Implement the no-args command index that lists all top-level commands with descriptions from the subcommands map

## 3. CLI registration

- [x] 3.1 Register `help` subcommand in `packages/cli/src/index.ts` alongside existing subcommands

## 4. Verification

- [x] 4.1 Run `pnpm typecheck` and `pnpm lint` to verify no errors
- [x] 4.2 Build the CLI with `pnpm build` and verify help files are embedded in the bundle
