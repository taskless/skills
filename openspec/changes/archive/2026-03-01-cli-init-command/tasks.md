## 1. Update Source Skills

- [x] 1.1 Add `metadata.version` field to `plugins/taskless/skills/info/SKILL.md` frontmatter (set to CLI package version)
- [x] 1.2 Remove `.claude-plugin/marketplace.json` and `plugins/taskless/.claude-plugin/plugin.json`

## 2. Build Pipeline

- [x] 2.1 Add `gray-matter` as a dependency in `packages/cli/package.json`
- [x] 2.2 Add `import.meta.glob` for `../../plugins/taskless/skills/**/SKILL.md` with `?raw` in `cli/src/actions/install.ts` and export a function to access embedded skills
- [x] 2.3 Declare `__VERSION__` and the glob import types in `cli/src/globals.d.ts` if needed

## 3. Install Actions

- [x] 3.1 Create `cli/src/actions/install.ts` with the `ToolDescriptor` type and `TOOLS` registry array (start with Claude Code entry)
- [x] 3.2 Implement `detectTools(cwd)` — parallel `fs.stat` on known tool directories, returns detected tool descriptors
- [x] 3.3 Implement `getEmbeddedSkills()` — parses the glob bundle via `gray-matter`, returns array of `{ name, content, metadata }` entries
- [x] 3.4 Implement `installForTool(cwd, tool, skills)` — writes SKILL.md files to tool's skill directory with `taskless-` prefix on directory and name field
- [x] 3.5 Implement `deriveCommand(skill)` — transforms skill frontmatter to command format (display name, category, tags, preserves metadata) and returns command file content
- [x] 3.6 Add command writing to `installForTool` for tools that have `commands` in their descriptor
- [x] 3.7 Implement `writeAgentsMd(cwd, version)` — creates or updates AGENTS.md with `<!-- BEGIN taskless version x.y.z -->` / `<!-- END taskless -->` region containing CLI pointer content

## 4. Init Command

- [x] 4.1 Create `cli/src/commands/init.ts` — citty `defineCommand` that calls `detectTools`, `getEmbeddedSkills`, `installForTool`/`writeAgentsMd`, and prints a summary
- [x] 4.2 Add global `-d` / `--dir` arg to the main command in `cli/src/index.ts`
- [x] 4.3 Register `init` and `update` (same command) as subcommands in `cli/src/index.ts`

## 5. Enhanced Info Command

- [x] 5.1 Implement `checkStaleness(cwd)` in `cli/src/actions/install.ts` — detects tools, reads installed skill files, extracts `metadata.version` via `gray-matter`, compares to embedded versions, also checks AGENTS.md marker version
- [x] 5.2 Update `cli/src/commands/info.ts` to output `{ version, tools: [...] }` JSON with per-tool, per-skill staleness status using `checkStaleness`

## 6. Verification

- [x] 6.1 Update `cli/test/cli.test.ts` — add tests for init command output, tool detection, and enhanced info output
- [x] 6.2 Run `pnpm typecheck` and fix any type errors
- [x] 6.3 Run `pnpm lint` and fix any lint issues
- [x] 6.4 Run `pnpm test` and verify all tests pass
- [x] 6.5 Run `pnpm build` and verify the built CLI bundles skill content
