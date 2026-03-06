# CLI

## MODIFIED Requirements

### Requirement: CLI builds with Vite

The CLI SHALL use Vite in library mode to produce a single bundled ESM output file. The build configuration SHALL live in `packages/cli/vite.config.ts`. The Vite build SHALL embed skills from `skills/` and commands from `commands/taskless/` via `import.meta.glob` with raw file imports. The build SHALL assert that every embedded skill's `metadata.version` matches the CLI's `package.json` version, failing with an error if any mismatch is detected.

#### Scenario: Build produces executable output

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** Vite SHALL produce a single file in `dist/` that is a valid Node.js ESM module with a shebang

#### Scenario: Build embeds skills from skills directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `SKILL.md` file under `skills/` at the repo root SHALL be embedded in the output bundle

#### Scenario: Build embeds commands from commands directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `.md` file under `commands/taskless/` at the repo root SHALL be embedded in the output bundle

#### Scenario: Build fails on version mismatch

- **WHEN** any embedded SKILL.md has a `metadata.version` that differs from `packages/cli/package.json` version
- **THEN** the Vite build SHALL fail with an error identifying the mismatched skill(s)

## REMOVED Requirements

### Requirement: CLI stub entry point

**Reason**: The `release` script (`"pnpm build && pnpm publish --access public"`) is removed from the CLI package. Build and publish are orchestrated from the root. The entry point requirement itself is NOT removed — only the `release` script within it. This is tracked as a partial modification: the `scripts` field in `packages/cli/package.json` SHALL NOT contain a `release` key.

**Migration**: Use root-level turbo commands for build and publish.
