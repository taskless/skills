## Why

The CLI currently only has an `info` subcommand. To deliver skills to user repositories, we need an `init` command (aliased as `update`) that installs and updates Taskless skill files into a project. This replaces the Claude plugin marketplace approach with a single, consistent CLI-driven install path that works across all supported AI tools.

## What Changes

- Add `taskless init` subcommand (aliased as `taskless update`) that installs or updates skills into a target repository
- Add global `-d` flag to set the working directory (defaults to `process.cwd()`)
- Bundle skill files into the CLI at build time so installation works offline with no fetch step
- Detect installed AI tools via parallel `fs.stat` on known directories (`.claude/`, `.cursor/`, etc.) — no config file
- Install skills as Agent Skills spec `SKILL.md` files into each detected tool's directory, namespaced under `taskless-`
- For Claude Code specifically, also derive and install `/command` `.md` files from skills
- Fall back to writing a thin `AGENTS.md` section (with `<!-- BEGIN taskless version x.y.z -->` markers) when no tool directories are detected
- Enhance `taskless info` to report installed tools and skill staleness by comparing `metadata.version` in installed files against the CLI's bundled versions
- **BREAKING**: Drop the `.claude-plugin/marketplace.json` plugin discovery approach in favor of CLI install

## Capabilities

### New Capabilities
- `cli-init`: The `init`/`update` subcommand, global `-d` flag, tool detection, skill installation, AGENTS.md fallback, and staleness reporting via `taskless info`

### Modified Capabilities
- `cli`: Add global `-d` flag for working directory, enhance `info` subcommand with staleness checks
- `skills`: Skills are now bundled into the CLI build and installed via `taskless init` rather than discovered via plugin marketplace. Source skills use bare names, prefixed to `taskless-<name>` at install time.

## Impact

- `packages/cli/`: New subcommand, new `src/actions/install.ts` module, build config changes to bundle skill content
- `plugins/taskless/skills/`: Source skill files bundled into CLI at build time; skill metadata gains `version` field
- `.claude-plugin/marketplace.json` and `plugins/taskless/.claude-plugin/plugin.json`: Removed (replaced by CLI install)
- `vite.config.ts`: Updated to embed skill file content into the bundle
- New runtime dependency candidates: YAML frontmatter parsing (for reading installed skill metadata)
