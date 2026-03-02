## Context

This repository currently contains Twitchdrift scaffolding (React Router, Cloudflare, Spotify, Kysely, etc.) that was copied over to bootstrap code style conventions. The core tooling — TypeScript, ESLint, Prettier, Husky, lint-staged, syncpack — is the foundation we're keeping. Everything else gets stripped or reorganized.

The target is a pnpm monorepo with two concerns:

1. A Claude Code plugin marketplace hosting Taskless skills (Sentry-compatible format)
2. A CLI package (`@taskless/cli`) distributed via npm

## Goals / Non-Goals

**Goals:**

- Clean root package to workspace-only tooling (zero runtime dependencies)
- Sentry-compatible `.claude-plugin/` marketplace structure with namespaced skills
- Working `/taskless:info` skill that confirms Taskless is operational
- `@taskless/cli` package with Vite library build producing a single executable bin
- CLI extends base tsconfig; has its own build and typecheck scripts
- pnpm workspace configured for `packages/*`

**Non-Goals:**

- CLI functionality beyond a stub entry point (auth, API calls, check runners come later)
- Multiple skills (only `info` for now)
- Publishing to npm (build pipeline, not publish pipeline)
- Cloudflare Workers or any deployment target

## Decisions

### Flat plugin structure over Sentry's nested `plugins/` convention

The skill files live at `plugins/taskless/skills/<name>/SKILL.md`. This is flatter than Sentry's `plugins/sentry-skills/skills/` but follows the same spec. Since this repo IS the Taskless plugin, deeper nesting adds no value.

**Alternative considered:** Putting skills directly in `skills/` at the root. Rejected because the `.claude-plugin/` marketplace spec expects a `plugins/<name>/` directory structure.

### Vite library mode for CLI build

The CLI uses Vite in library mode to produce a single bundled ESM file with a shebang. Vite is already in the ecosystem and handles TypeScript, tree-shaking, and bundling well.

**Alternative considered:** `tsup` or `unbuild`. These are popular for CLI builds but add another build tool to learn. Vite is already known in this codebase.

### Zero runtime dependencies in CLI (for now)

The CLI starts with no runtime dependencies. Validators and HTTP clients will be added when actual functionality requires them. This avoids premature dependency decisions.

### Root tsconfig stays minimal

The root `tsconfig.json` extends `tsconfig.base.json` but excludes `packages/` — each package manages its own compilation. No project references, no composite mode at root level.

**Alternative considered:** `tsc -b` with project references from root. Rejected because packages should own their own build concerns and the root has no source files.

### Namespace skills via plugin name

Skills are namespaced as `taskless:<skill-name>` through the Claude Code plugin system. The plugin name `taskless` provides the namespace prefix; the skill name (e.g., `info`) is scoped within it. This avoids conflicts with other skill providers.

## Risks / Trade-offs

- **Lock file churn**: Removing many dependencies will cause a large `pnpm-lock.yaml` diff. → Acceptable; this is a one-time cleanup.
- **Sentry skill spec may evolve**: The `.claude-plugin/` format is not formally versioned. → Low risk; Sentry's format is widely adopted and stable enough for our purposes.
- **CLI bin shebang handling**: Vite library mode doesn't add shebangs by default. → Use a Vite plugin or post-build script to prepend `#!/usr/bin/env node`.
