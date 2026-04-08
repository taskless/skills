## Context

The CLI's `detectTools()` function checks for known directories to decide where to install skills. Currently, `ToolDescriptor` uses a single `dir` field for both detection and install path. Only Claude Code (`.claude/` directory) is supported.

We need to support four tool targets with detection signals that include both files and directories, and add a fallback install path when no tools are detected.

## Goals / Non-Goals

**Goals:**

- Detect Claude Code, OpenCode, Cursor, and install skills into each detected tool's directory
- Support file-based detection signals (e.g., `CLAUDE.md`, `.cursorrules`, `opencode.json`)
- Provide `.agents/skills/` as a fallback when no tools are detected
- Keep the install logic unchanged — only detection and the tool registry expand

**Non-Goals:**

- Adapting skill content per tool (all tools get identical `SKILL.md` files)
- Supporting tool-specific config file generation (e.g., creating `.cursorrules`)
- Auto-detecting tools that require network or process inspection
- Adding commands support for any tool other than Claude Code

## Decisions

### Split detection signals from install root

**Decision:** Replace the single `dir` field in `ToolDescriptor` with separate `detect` and `installDir` fields.

**Rationale:** Detection of `CLAUDE.md` (a file) should trigger installation into `.claude/` (a directory). The current design conflates these — `dir` is both the detection check and the install root. Splitting them keeps each concern clean.

**`detect`** is an array of signal objects:

```typescript
type DetectionSignal =
  | { type: "directory"; path: string }
  | { type: "file"; path: string };
```

**`installDir`** is the directory root for skill (and optionally command) installation. This replaces `dir`.

**Alternative considered:** Keep `dir` and add an optional `additionalSignals` array. Rejected because it makes `dir` semantically overloaded — it would mean "primary detection signal AND install root," which is confusing when the primary signal for a tool might be a file.

### Fallback is handled in init, not in detection

**Decision:** The `.agents/` fallback is not a detected tool. Instead, `init.ts` checks whether any installs were made after the tool loop and falls back to a hardcoded `AGENTS_FALLBACK` descriptor.

**Rationale:** `.agents/` has no detection signal — it exists precisely because nothing was detected. Modeling it as a detected tool would require a sentinel like `detect: []` meaning "always match," which is misleading. Keeping it as explicit fallback logic in `init.ts` makes the intent clear.

### Detection uses `stat` for directories and `access` for files

**Decision:** Directory signals use `stat().isDirectory()` (existing pattern). File signals use `access()` with `constants.F_OK` — we only need existence, not content.

**Rationale:** `access` is marginally cheaper than `stat` for pure existence checks on files. For directories we still need `isDirectory()` to distinguish from files of the same name.

## Risks / Trade-offs

**[Multiple installs create duplication]** → A repo with both `.claude/` and `.cursor/` gets skills in two places. This is intentional — each tool reads from its own directory. Users who find this noisy can remove the tool directory they don't use.

**[File detection may create directories]** → Detecting `CLAUDE.md` without a `.claude/` directory means `mkdir -p .claude/skills/` runs during install, creating a new directory. This is acceptable — if the user has `CLAUDE.md`, they're using Claude Code and will benefit from having skills installed. Same applies to `.cursorrules` creating `.cursor/skills/`.

**[`.cursorrules` false positives]** → `.cursorrules` is widely used and still actively supported by Cursor. Detection of it is a valid signal that the project uses Cursor.
