## Context

The CLI currently has a single `info` subcommand and one runtime dependency (`citty`). Skills are defined in `plugins/taskless/skills/` using Agent Skills spec format. The CLI is built with Vite in library mode, producing a single bundled ESM file. There is no mechanism to install skills into user repositories — they rely on a `.claude-plugin/marketplace.json` plugin discovery approach that only works for Claude Code.

## Goals / Non-Goals

**Goals:**

- Add `init`/`update` subcommand that installs skills into user repositories
- Support multiple AI tools via a tool detection matrix
- Bundle skills into the CLI binary so install works offline
- Derive Claude-specific command files from canonical skills at install time
- Provide staleness reporting in `taskless info`
- Keep the CLI lean — minimal new dependencies

**Non-Goals:**

- Fetching skills from a remote source (all content is bundled)
- Interactive tool selection prompts (detect what's present, install for those)
- Supporting non-Agent Skills spec formats (tools must support SKILL.md or get AGENTS.md fallback)
- Plugin marketplace support (being removed)

## Decisions

### Decision 1: Bundle skills via Vite `import.meta.glob`

Embed skill file content into the CLI bundle at build time using Vite's `import.meta.glob` with `?raw` query.

```typescript
// In cli/src/actions/install.ts
const skillFiles = import.meta.glob(
  "../../plugins/taskless/skills/**/SKILL.md",
  { query: "?raw", import: "default", eager: true }
);
```

This produces a record of `{ [path]: content }` at build time. Vite resolves the paths relative to the source file and inlines the content as strings. No extra build step, no generated files, no script to maintain.

**Alternative considered**: A prebuild script that generates `src/generated/skills.ts`. This would pre-parse frontmatter and avoid runtime YAML parsing, but adds a build step to maintain and generated files to gitignore. The glob approach is simpler and Vite-native.

**Trade-off**: The glob path `../../plugins/taskless/skills/` crosses the package boundary. This is normal in monorepos and Vite handles it correctly, but it's a path to be aware of if the directory structure changes.

### Decision 2: `gray-matter` for frontmatter parsing

Add `gray-matter` as a runtime dependency (bundled by Vite). Used for:

1. Parsing embedded skill content to extract metadata (name, description, version)
2. Parsing installed skill files for staleness comparison
3. Extracting frontmatter fields during command derivation

**Alternative considered**: Regex-based extraction of just the `version` field. This avoids a dependency but is fragile and doesn't support command derivation which needs full frontmatter access.

**Trade-off**: `gray-matter` bundles `js-yaml` internally, adding ~15-20KB to the CLI bundle. Acceptable for a CLI tool.

### Decision 3: Tool matrix as a typed const array

Define the AI tool registry in `cli/src/actions/install.ts` as a typed array of tool descriptors. Each entry specifies the tool's directory, skill install path, and optional command support.

```typescript
interface ToolDescriptor {
  name: string; // Display name (e.g., "Claude Code")
  dir: string; // Detection directory (e.g., ".claude")
  skills: {
    path: string; // Subdirectory for skills (e.g., "skills")
    prefix: string; // Name prefix (e.g., "taskless-")
  };
  commands?: {
    path: string; // Subdirectory for commands (e.g., "commands/taskless")
  };
}
```

The initial matrix includes Claude Code (skills + commands) with other tools added as validated. AGENTS.md is handled separately as a fallback, not as a tool entry.

### Decision 4: Skill → Command derivation at install time

For tools that support commands (currently Claude Code), derive command `.md` files from the canonical SKILL.md at install time. The transformation:

- **name**: `info` → `"Taskless: Info"` (title-cased with namespace prefix)
- **description**: carried over (may be shortened)
- **add**: `category: "Taskless"`, `tags: ["taskless"]`
- **strip**: `license`, `compatibility`, `metadata`
- **body**: carried over as-is

The `metadata` field (including `version`) is kept in command files despite being a skill-spec field. This redundancy ensures staleness checks work uniformly regardless of whether a file is a skill or command.

### Decision 5: AGENTS.md fallback with comment markers

When no tool directories are detected, write a thin section to `AGENTS.md` using markdown comment markers:

```markdown
<!-- BEGIN taskless version x.y.z -->

...brief CLI overview...

<!-- END taskless -->
```

Content encourages use of `pnpm dlx @taskless/cli` or `npx @taskless/cli` for capability discovery, with a brief table of available commands. This is deliberately minimal — it's a pointer to the CLI, not a replacement for tool-specific skill files.

Region replacement uses string operations to find/replace between markers, preserving all content outside the region.

### Decision 6: Staleness check via `metadata.version`

`taskless info` is enhanced to:

1. Detect installed tools (same detection as init)
2. For each tool, read installed skill files and extract `metadata.version` from frontmatter
3. Compare against the CLI's embedded skill versions
4. Report per-tool, per-skill status (current / outdated / missing)

Output remains JSON for machine consumption. The version field from the AGENTS.md opening comment marker is parsed with a regex.

### Decision 7: Global `-d` flag via citty args

The main command defines a `dir` arg (`-d` alias) that defaults to `process.cwd()`. Subcommands access this via the parent command's parsed args. Each subcommand resolves its working directory from this value.

### Decision 8: File structure for actions

Following the user preference for functions over classes, install logic lives in `cli/src/actions/install.ts` as exported functions:

- `detectTools(cwd: string)` — parallel `fs.stat` on known tool directories
- `getEmbeddedSkills()` — returns parsed skill entries from the glob bundle
- `installForTool(cwd, tool, skills)` — writes skills (and derived commands) for a specific tool
- `writeAgentsMd(cwd, skills, version)` — creates/updates the AGENTS.md region
- `checkStaleness(cwd)` — reads installed files, compares versions to embedded

The init command in `cli/src/commands/init.ts` is a thin citty command definition that calls into these functions.

## Risks / Trade-offs

- **[Cross-package glob path]** → The `../../plugins/` path couples the CLI build to the monorepo layout. Mitigated by Vite's reliable path resolution and the monorepo structure being stable.
- **[gray-matter bundle size]** → Adds ~15-20KB to CLI. Acceptable for a CLI tool that already bundles citty. If bundle size becomes a concern, could be replaced with a minimal frontmatter parser.
- **[Tool detection false positives]** → A `.claude/` directory could exist without Claude Code. Mitigated by the fact that writing skill files into it is harmless — they'll simply be ignored if the tool isn't present.
- **[AGENTS.md conflicts]** → Multiple tools writing to AGENTS.md could produce a messy file. Mitigated by using unique comment markers with the `taskless` namespace.
- **[Command format drift]** → Claude's command format could change independently of the Agent Skills spec. Mitigated by keeping derivation logic isolated in a single function.
