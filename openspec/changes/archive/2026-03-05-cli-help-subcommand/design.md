## Context

The CLI uses citty for argument parsing and subcommand routing. Skills and commands are already embedded at build time via `import.meta.glob` in `packages/cli/src/actions/install.ts` and consumed by the Vite build. The CLI currently has no `help` subcommand — citty's built-in `showUsage` only generates terse arg listings, not rich documentation.

Agent skills (e.g., `taskless-check`, `taskless-rule-create`) currently contain their own usage documentation, duplicating what the CLI knows. Moving help into the CLI makes it the single source of truth.

## Goals / Non-Goals

**Goals:**

- `taskless help <command>` displays rich help text for any registered command
- `taskless help <group> <subcommand>` works for nested commands (e.g., `help auth login`)
- `taskless help` with no arguments lists all top-level commands with descriptions
- Help content is embedded at build time — no filesystem or network access at runtime
- Help text format is plain text suitable for terminal output

**Non-Goals:**

- JSON output for help (not needed — agents can parse the text or skills can be updated later)
- Modifying agent skills to delegate to `taskless help` (separate follow-up change)
- Auto-generating help from citty command definitions (we want richer content than citty provides)

## Decisions

### Help files live at `packages/cli/src/help/*.txt`

Help text files are plain `.txt` files inside the CLI package source tree. They are embedded at build time via `import.meta.glob("./help/**/*.txt", { query: "?raw", import: "default", eager: true })` in the help command file.

**Why not repo root?** Skills and commands live at repo root because they're distributed independently. Help files are internal to the CLI — they're implementation details of the `help` subcommand, not a separate distribution concern.

**Why `.txt` not `.md`?** This is terminal output, not rendered markdown. Plain text avoids any temptation to add formatting that won't render in a terminal. It also distinguishes help files from the skill/command `.md` files that serve a different purpose.

### Naming convention uses hyphen-joined command path

File naming: `<command>.txt` for top-level commands, `<group>-<subcommand>.txt` for nested commands.

```
help/
  check.txt           ← taskless help check
  init.txt            ← taskless help init
  info.txt            ← taskless help info
  auth.txt            ← taskless help auth
  auth-login.txt      ← taskless help auth login
  auth-logout.txt     ← taskless help auth logout
  rules.txt           ← taskless help rules
  rules-create.txt    ← taskless help rules create
  rules-delete.txt    ← taskless help rules delete
```

Resolution: join positional args with `-`, look up in the embedded map. The glob key contains the relative path (e.g., `./help/auth-login.txt`), so we strip the prefix and extension to get the lookup key.

### Help command uses citty positional args

The help command accepts variadic positional input via `rawArgs`. It joins non-flag args to form the lookup key. If no args are provided, it displays a command index. If the lookup fails, it prints an error with available commands.

**Alternative considered:** Registering help as a flag (`--help`) on each command. Rejected because citty already handles `--help` with its terse format — we don't want to override that behavior, and `taskless help check` is the more natural UX for rich documentation.

### Command index is built from the subcommands map

When `taskless help` is run with no arguments, the help command reads the `meta.description` from each registered subcommand to build a listing. This avoids duplicating command descriptions in a separate file. The subcommands map is passed to the help command module at registration time.

## Risks / Trade-offs

- **Help files can drift from implementation** → Mitigated by keeping files close to the code (same package). Help content should be updated alongside command changes as part of PR review. No automated check enforced.
- **No version in help output** → The main CLI already shows version. Help text doesn't repeat it.
- **Glob import path coupling** → The glob pattern in `import.meta.glob` is relative to the source file. If the help command file moves, the pattern needs updating. Low risk since the directory structure is stable.
