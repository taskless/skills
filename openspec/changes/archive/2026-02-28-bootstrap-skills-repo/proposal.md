## Why

This repository needs to be transformed from its Twitchdrift origins into a Taskless skills repo for agentic flows. The repo will serve two purposes: hosting Claude Code-compatible skills (starting with `/taskless:info`) and providing a CLI package (`@taskless/cli`) that can install skills, run checks, and eventually handle auth and API calls to taskless.io.

## What Changes

- **BREAKING** Strip all Twitchdrift-specific dependencies (React, Cloudflare, Spotify, Kysely, Tailwind, etc.) from root `package.json`
- **BREAKING** Remove Twitchdrift-specific files (`vite.config.ts`, Twitchdrift README content)
- **BREAKING** Remove all Twitchdrift-specific scripts from root `package.json`
- Rename root package to `@taskless/skills`
- Set up pnpm workspace with `packages/*`
- Create `.claude-plugin/` marketplace structure (Sentry-compatible skill format)
- Create `plugins/taskless/` with plugin manifest and first skill (`info`)
- Create `packages/cli/` package (`@taskless/cli`) with Vite library build targeting a single bin entry
- Clean up `eslint.config.js` to remove Twitchdrift-specific ignores
- Rewrite `README.md` for the skills repo
- Simplify root `tsconfig.json`

## Capabilities

### New Capabilities

- `skills`: Claude Code plugin marketplace structure for hosting Taskless skills, starting with `/taskless:info`
- `cli`: `@taskless/cli` package with Vite build system, executable bin entry, and its own tsconfig extending the base

### Modified Capabilities

_None — this is a greenfield transformation._

## Impact

- **Root `package.json`**: Renamed, dependencies gutted, scripts replaced with `lint`, `lint:fix`, `prepare`
- **Build system**: Root `vite.config.ts` removed; new `packages/cli/vite.config.ts` created for CLI library build
- **TypeScript**: Root `tsconfig.json` simplified (no composite, no project refs); CLI gets own tsconfig extending base
- **ESLint**: Config cleaned up, `.react-router/` and Twitchdrift patterns removed
- **New directories**: `.claude-plugin/`, `plugins/taskless/`, `packages/cli/`
- **pnpm workspace**: New `pnpm-workspace.yaml` declaring `packages/*`
