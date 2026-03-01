## Context

The CLI is a stub (`console.log("Taskless CLI is running.")`) built with Vite in library mode. The `/taskless:info` skill currently has placeholder instructions. Skills need to invoke the CLI as a subprocess and parse structured output. This change wires up the first real CLI command and the first skill-to-CLI interaction.

## Goals / Non-Goals

**Goals:**

- citty-based subcommand structure for the CLI
- `taskless info` outputs `{"version":"<version>"}` to stdout
- `taskless` with no args shows help
- Version injected at build time via Vite `define`
- SKILL.md instructs agents to detect PM via lock file, invoke CLI via dlx/npx, parse JSON

**Non-Goals:**

- Interactive prompts or terminal UI
- Local CLI installation detection (always use dlx/npx)
- Yarn or Bun support (pnpm and npm only for now)
- Additional subcommands beyond `info`

## Decisions

### citty over commander for argument parsing

citty uses a declarative subcommand model where each command is an isolated object. Commander uses a fluent API with `--` flags baked into every level, which creates friction when subcommands have their own arguments. citty is 12kb (vs commander's 52kb), ESM-first, TypeScript-native, and from the UnJS ecosystem.

**Alternative considered:** commander — most popular, well-documented, but its flag-first design (`--version`, `--help`) mingles with subcommand arguments. Also considered `cac` (lighter) but citty's declarative subcommands map more cleanly to the command-per-file pattern.

### Vite `define` for version injection

The CLI version comes from `packages/cli/package.json`. Vite's `define` option replaces `__VERSION__` with the literal string at build time. No runtime file reads, no import assertions, no path resolution issues in bundled output.

**Alternative considered:** `import pkg from '../package.json'` with JSON import — works but requires Vite JSON handling config and adds the entire package.json to the bundle.

### Always dlx/npx, never local

The skill always runs `pnpm dlx @taskless/cli@latest info` or `npx @taskless/cli@latest info`. No local installation detection. This keeps the SKILL.md simple and ensures the latest version is always used.

### Lock file detection for package manager

The skill checks for `pnpm-lock.yaml` in the project root. If found, use `pnpm dlx`. Otherwise, default to `npx`. Two paths, deterministic, no version probing needed.

## Risks / Trade-offs

- **dlx/npx latency**: Every invocation downloads the package. → Acceptable for a health check command; future commands with heavier use can revisit local installation.
- **citty is less well-known than commander**: → Mitigated by simple usage pattern and good TypeScript types. The UnJS ecosystem is actively maintained.
- **`@latest` tag could break**: If a bad version is published, skills would invoke it. → Standard npm risk; can pin versions later if needed.
