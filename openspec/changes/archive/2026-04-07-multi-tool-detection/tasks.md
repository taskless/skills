## 1. Refactor ToolDescriptor to split detection from install path

Purely structural refactor — no new tools, no behavior change. Claude Code remains the only tool, still detected by `.claude/` directory only.

- [x] 1.1 Add `DetectionSignal` type (`{ type: "directory" | "file"; path: string }`) to `packages/cli/src/install/install.ts`
- [x] 1.2 Replace `dir` field in `ToolDescriptor` with `detect: DetectionSignal[]` and `installDir: string`
- [x] 1.3 Update Claude Code entry in `TOOLS` to use `detect: [{ type: "directory", path: ".claude" }]` and `installDir: ".claude"`
- [x] 1.4 Update `detectTools()` to iterate each tool's `detect` array, using `stat().isDirectory()` for directory signals and `stat().isFile()` for file signals
- [x] 1.5 Update `installForTool`, `removeOwnedSkills`, `removeOwnedCommands`, and `checkStaleness` to use `installDir` instead of `dir`
- [x] 1.6 Create `test/install.test.ts` with baseline detection tests: Claude Code detected via `.claude/` directory, not detected when absent
- [x] 1.7 Test `installForTool` writes skills to `installDir`-based path and creates directories if missing
- [x] 1.8 Test `checkStaleness` reports status using `installDir`-based paths
- [x] 1.9 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## 2. Expand Claude Code detection and add OpenCode and Cursor tools

Add new detection signals and tool entries. Each detected tool gets skills installed.

- [x] 2.1 Add `CLAUDE.md` file signal to Claude Code's `detect` array
- [x] 2.2 Add OpenCode entry: detect `[".opencode/" dir, "opencode.jsonc" file, "opencode.json" file]`, installDir `.opencode`, no commands
- [x] 2.3 Add Cursor entry: detect `[".cursor/" dir, ".cursorrules" file]`, installDir `.cursor`, no commands
- [x] 2.4 Test `detectTools()` detects Claude Code via `.claude/` directory
- [x] 2.5 Test `detectTools()` detects Claude Code via `CLAUDE.md` file
- [x] 2.6 Test `detectTools()` detects OpenCode via `.opencode/` directory, `opencode.jsonc`, and `opencode.json`
- [x] 2.7 Test `detectTools()` detects Cursor via `.cursor/` directory and `.cursorrules`
- [x] 2.8 Test `detectTools()` returns multiple tools when multiple signals exist
- [x] 2.9 Test `detectTools()` returns empty when no signals match
- [x] 2.10 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## 3. Add .agents fallback when no tools detected

Replace the "no tools found" message with a fallback install to `.agents/skills/`.

- [x] 3.1 Define `AGENTS_FALLBACK` descriptor: no detect array, installDir `.agents`, no commands
- [x] 3.2 In `init.ts`, track whether any installs were made after the tool loop
- [x] 3.3 If zero installs, call `installForTool(cwd, AGENTS_FALLBACK, skills, [])` and report fallback usage
- [x] 3.4 Remove the old "no supported tool directories detected" message
- [x] 3.5 Test fallback installs to `.agents/skills/` when no tools detected
- [x] 3.6 Test fallback is NOT used when at least one tool is detected
- [x] 3.7 Test fallback does not install commands
- [x] 3.8 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## 4. Update info command and help text

- [x] 4.1 Verify `info.ts` works with updated `checkStaleness()` (uses `installDir`)
- [x] 4.2 Update `src/help/init.txt` if it references detection behavior
- [x] 4.3 Test `checkStaleness` returns correct status for each newly supported tool (OpenCode, Cursor, `.agents/`)
- [x] 4.4 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
