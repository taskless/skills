## Context

The `@taskless/cli` currently has `init`, `update`, and `info` subcommands. The Taskless platform generates ast-grep rules into a `.taskless/` directory via PRs. Users need a way to run those rules locally and in CI. The `.taskless/` directory scaffold (created by the generator's onboarding flow) contains `taskless.json`, `sgconfig.yml`, and a `rules/` directory.

The CLI uses citty for argument parsing, Vite for bundling, and follows a pattern of command files in `src/commands/` backed by action logic in `src/actions/`.

## Goals / Non-Goals

**Goals:**
- Add a `taskless check` subcommand that runs ast-grep rules from `.taskless/rules/`
- Own the output format in both human and JSON modes (don't pass through ast-grep's raw output)
- Design the scanner/formatter boundary to support additional scanning tools in the future
- Add a global `--json` flag that all commands can use for machine-readable output
- Work cross-platform (Linux, macOS, Windows)

**Non-Goals:**
- Supporting custom sgconfig locations (always `.taskless/sgconfig.yml`)
- SARIF output format (future enhancement)
- `--fail-on` severity control (future enhancement)
- Modifying the `.taskless/` scaffold format (owned by the generator)
- Running ast-grep via the `@ast-grep/napi` library (CLI binary approach chosen)

## Decisions

### Decision 1: Use `@ast-grep/cli` binary, not `@ast-grep/napi`

**Choice:** Shell out to the `sg` binary provided by `@ast-grep/cli` npm package.

**Rationale:** The napi library provides per-file, per-rule scanning via `findInFiles()`. Running a full lint pass with many YAML rules would require reimplementing ast-grep's orchestration: YAML rule loading, language grouping, file discovery, `utils` resolution, and result assembly. The CLI binary handles all of this, and `--json=stream` gives structured JSONL output we can parse and reformat.

**Alternatives considered:**
- `@ast-grep/napi` with custom orchestration — high implementation cost, maintains parity with ast-grep features
- Bundling/downloading ast-grep separately — unnecessary complexity when the npm package handles platform-specific binaries

### Decision 2: Always run `sg scan --json=stream` internally

**Choice:** Regardless of output mode, the check command always invokes `sg scan` with `--json=stream` and parses the results into an internal `CheckResult` type. The formatter then outputs either human-readable text or JSON based on the `--json` flag.

**Rationale:** This gives full control over the output contract in both modes. It also creates a clean boundary for adding future scanners — any scanner that produces `CheckResult[]` can plug into the same formatter.

### Decision 3: `spawn` with `shell: true` for cross-platform binary resolution

**Choice:** Use `child_process.spawn('sg', args, { shell: true, cwd })` to execute the ast-grep binary.

**Rationale:** On Unix, `spawn` searches PATH. On Windows, the `sg` binary is installed as `sg.cmd` in `node_modules/.bin/`, which requires shell resolution. Since all arguments are controlled (no user input in the command string), `shell: true` has no injection risk. When the CLI is run via `pnpm dlx` or `npx`, `node_modules/.bin` is automatically added to PATH.

**Alternatives considered:**
- `cross-spawn` package — adds a dependency for the same result
- Manual binary path resolution with platform checks — more code, fragile

### Decision 4: `--json` as a global flag on the main command

**Choice:** Add `--json` to the main command's `args` definition in `index.ts` so it's available to all subcommands via citty's argument inheritance.

**Rationale:** Consistent behavior across all commands. The `info` command already outputs JSON unconditionally — with `--json` as a global flag, `info` can adopt it for consistency, and future commands get it for free.

### Decision 5: Scanner-agnostic result type with formatter layer

**Choice:** Define a `CheckResult` interface as the boundary between scanners and output formatting. The ast-grep scanner maps its JSON output to `CheckResult[]`, and the formatter consumes `CheckResult[]` to produce either format.

```
Scanner (ast-grep) → CheckResult[] → Formatter (text | json)
```

**Rationale:** The check command will support additional scanning tools in the future. Owning the result type means the output contract is stable regardless of which scanner produced the results.

### Decision 6: Exit codes — 0 for clean/warnings, 1 for errors

**Choice:** Exit 0 when no error-severity matches are found (including when only warnings/hints exist). Exit 1 when at least one error-severity match is found. When the `.taskless` directory is missing, exit 1. When rules directory is empty, warn and exit 0.

**Rationale:** Matches ast-grep's built-in behavior. CI pipelines get a useful default without configuration. A `--fail-on` flag can be added later for granular control.

## Risks / Trade-offs

- **ast-grep CLI output format changes** → Pin `@ast-grep/cli` to a known version range. The JSONL output schema is stable and well-documented. Mitigation: schema validation on parsed output.
- **Binary size in published package** → `@ast-grep/cli` uses platform-specific optional dependencies (same pattern as esbuild, turbo). Only the relevant platform binary is installed. Users running `pnpm dlx @taskless/cli check` will download the ast-grep binary on first use.
- **Windows shell execution** → `shell: true` delegates to `cmd.exe` on Windows, which resolves `.cmd` wrappers correctly. Tested pattern used by many Node.js CLI tools.
- **Empty rules directory** → Warn but exit 0. Users who have onboarded but haven't generated rules yet should not fail CI.
