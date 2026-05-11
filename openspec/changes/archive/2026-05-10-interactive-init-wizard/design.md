## Context

Today's `taskless init` is a ~60-line handler that detects tools, installs every skill to every detected tool, and prints a summary. It has no user interaction, no way to opt in/out of locations, and no notion of optional skills. The CLI is built on `citty` (lightweight command framework with no prompt support) and ships 9 skills. `.taskless/taskless.json` currently only carries `{ version: number }` for the migration system.

The upcoming CI skill (OSS-3) is the first skill not every user wants — it's opt-in by nature since it touches the CI pipeline. That creates the need for a selection UI. At the same time, OSS-4 captures a broader observation: the init command is a user's first touchpoint with Taskless, and the current non-interactive flow misses an opportunity to explain auth, confirm choices, and record what was installed.

Separately, PostHog telemetry currently attaches only `cli: anonymousId` to events. We have no way to slice events by CLI version or scaffold (manifest) version — a gap that has started to block deprecation planning. Adding these as standard properties is adjacent to this change and worth folding in rather than spinning up separately.

Constraints:

- `citty` has no prompt API; we need a prompt library alongside it.
- Every new interactive element must have a non-interactive fallback so CI/scripted installs keep working.
- `@clack/prompts` throws on Ctrl-C via a unique `isCancel()` Symbol — we cannot rely on try/catch alone.
- The `.taskless/taskless.json` manifest must round-trip unknown fields so future changes don't have to coordinate with this one.

## Goals / Non-Goals

**Goals:**

- Make `taskless init` interactive by default, with a single-screen-per-step clack wizard.
- Give users explicit control over install locations (including undetected ones) and optional skills.
- Record installed state in `taskless.json` so re-runs can compute a precise diff and remove what's no longer selected.
- Surface the auth vs. anonymous tradeoff at a moment the user can act on it, without forcing them to log in.
- Preserve today's exact behavior behind `--no-interactive` for scripted environments.
- Add `cliVersion` / `scaffoldVersion` to every telemetry event so we can answer "which version is this user on?" in PostHog.
- Introduce the `taskless-ci` skill as a bundled but optional skill (body deferred to OSS-3).

**Non-Goals:**

- Building a `taskless uninstall` or `taskless clean` subcommand. The install manifest unlocks a future uninstall but this change doesn't ship one.
- Active deprecation behavior (CLI checks its own version against a server-supplied floor and warns/errors). This change only passively attaches versions to events; the warning logic is a future change.
- Changing the existing dual-skill auth pattern (`taskless-create-rule` vs `taskless-create-rule-anonymous`). That stays as-is.
- Finalizing the ASCII-art banner design. A placeholder ships; real art iterates post-merge.
- Replacing `citty` as the command framework. We add clack alongside it.

## Decisions

### Prompt library: `@clack/prompts` (not `@inquirer/prompts`, not `prompts`)

Chosen for small size, first-class cancellation support (`isCancel()` returns a Symbol), built-in grouping (`group()`), a polished default aesthetic that matches modern CLIs, and peer-depending on `picocolors` which we want anyway.

Alternatives considered:

- `@inquirer/prompts`: larger surface, per-prompt imports, less aligned aesthetics. Overkill for five steps.
- `prompts`: older, smaller, but maintenance is spotty and multi-select UX is weaker.
- `enquirer`: flexible but older style; aesthetics don't match where the ecosystem has moved.

### Command topology: bare `taskless` → `init`, not a separate entry

`taskless` with no subcommand currently prints top-level help. We redirect it to `init` when stdout is a TTY. Non-TTY invocations (pipes, CI logs) still show help to preserve scripting affordances. The explicit `taskless help` command always shows help regardless of TTY.

Alternative: introduce a new `taskless wizard` subcommand and leave `init` non-interactive. Rejected — two code paths for the same user intent ("set this up"), and new users wouldn't discover `wizard`.

### `--no-interactive` preserves today's behavior exactly

Adding a flag that changes semantics (e.g., "non-interactive also installs CI") would silently break scripted installs. `--no-interactive` matches current behavior: every mandatory skill to every detected location, no auth, no optional skills, `.agents/` fallback when nothing detected. Users who want optional skills in a scripted install will get explicit flags (e.g., `--skill taskless-ci`) in a later change if we need them — not this one.

### Skill catalog: optional/mandatory classification in the bundle

Each skill gets a `optional: boolean` tag in a TypeScript catalog file that lives alongside the skill source. The install code reads from this catalog rather than inferring optionality from path or frontmatter. This keeps the source of truth in one place and avoids a skill's SKILL.md carrying install-time metadata (which would blur the Agent Skills spec format).

Alternative: use a `x-taskless-optional: true` field in the SKILL.md frontmatter. Rejected — non-Taskless agents reading the same SKILL.md would see noise.

### Install state lives in `taskless.json`, granular by target

The manifest gains:

```jsonc
{
  "version": 2,
  "install": {
    "installedAt": "2026-04-16T…Z",
    "cliVersion": "0.5.4",
    "targets": {
      ".claude": {
        "skills": ["taskless-check", "taskless-ci"],
        "commands": ["rule", "check"],
      },
      ".cursor": { "skills": ["taskless-check"] },
    },
  },
}
```

Keyed-by-target is more verbose than a flat `locations: [...]` list but unlocks surgical cleanup: when a user deselects `.cursor/`, we can delete exactly the files we wrote there, not risk touching non-Taskless files. Essential for eventually shipping a safe `taskless clean`.

### Shared `loginInteractive()` function

The wizard's auth step calls the same code path as `taskless auth login`. The function signature is:

```ts
async function loginInteractive(options?: {
  cwd?: string;
}): Promise<{ status: "ok" } | { status: "cancelled" }>;
```

It runs the device-code flow, prints the URL/code, polls the token endpoint, writes the token on success, and returns. Callers decide what to do with the result (wizard advances either way with a hint on cancel; `auth login` exits non-zero on cancel).

### Telemetry super-properties via `getTelemetry()` init

`cliVersion` and `scaffoldVersion` are resolved once when `getTelemetry(cwd)` first runs:

- `cliVersion`: embedded at build time via Vite (read from `packages/cli/package.json`) — avoids a runtime filesystem read and stays accurate even if the user has multiple CLIs installed.
- `scaffoldVersion`: read from `.taskless/taskless.json` at telemetry init time, or `0` if missing/unreadable.

Both are stored in the closure returned by `getTelemetry()` and merged into every `capture()` call's properties. This is the smallest patch to the existing telemetry module and avoids threading versions through every call site.

### Wizard steps live under `packages/cli/src/wizard/`

Each step is a pure function returning its selection result. The top-level `runWizard()` composes them with `@clack/prompts.group()`. This keeps the file structure discoverable, makes unit-testing individual steps straightforward (mock clack, assert step logic), and gives us a seam for the banner (which also lives in `wizard/`).

### CI skill: patterns over enumeration

The `taskless-ci` skill is installed into other users' repos and invoked by their agents. If it hardcodes a fixed enumeration of CI systems with exact detection logic, the skill rots the moment a new CI system gains traction. Instead the skill teaches **two patterns** (full scan / diff scan) plus the universal six-step skeleton (checkout → fetch base → diff → filter → invoke check → report), and lists common CI systems as hints rather than an exhaustive switch. Agents that recognize unlisted CI systems are told to apply the same patterns idiomatically.

The skill ships no slash command — it's discovered by agents via its `description` field. Per the repo convention used by the other no-command skills (`taskless-create-rule-anonymous`, `taskless-improve-rule-anonymous`, `taskless-delete-rule`), its frontmatter sets `metadata.commandName: "-"`. This keeps `commands/tskl/` clean and avoids the impression that users should run `tskl:ci` directly.

### Intro banner: frozen ASCII wordmark, quad-block 60 cols

Ship a pre-rendered ASCII version of the Taskless wordmark, locked to 60 columns × 5 rows, produced by a one-time offline pass over `tmp/logo-dark-on-white.png` using a small `jimp`-based converter at `tmp/ascii-tool/convert.mjs`. The converter is not shipped in the CLI bundle — the output is embedded as a string constant in `wizard/intro.ts`.

The banner:

```
██████████
▄▄▄▄   ▗▄▄  ▗▄█▙▄▖ ▗▄▄▖   ▄▄▄ ▐█  ▄▖ ▀▀█    ▄▄▖   ▄▄▄   ▄▄▄
██▛▘▗▟████  ▝▀█▛▀▘ ▀ ▝█▖ █▙ ▝▘▐█▗▟▀    █  ▗█▘ ▜▙ █▙ ▝▘ █▙ ▝▘
█▛ ▗██████    █▌  ▐█▀▀█▌  ▀▀▜▙▐█▀▜▙    █  ▐█▀▀▀▀  ▀▀▜▙  ▀▀▜▙
█▘ ███████    ▀▀▀▘▝▀▀▀▀▀ ▀▀▀▀▘▝▀  ▀▘ ▀▀▀▀▀ ▝▀▀▀▘ ▀▀▀▀▘ ▀▀▀▀▘
```

Quad-block mode samples two source pixels horizontally per cell (versus one for half-block), producing crisper letterforms and a more faithful rendition of the curved "7" mark in the same 60×5 footprint. Quadrant chars (▖▗▘▝▙▟▚▞ etc.) live in the same legacy block-drawing range (U+2580–U+259F) as half-block chars, so the portability arguments below apply unchanged.

Rationale for the block-drawing range over braille (U+2800–U+28FF):

- Screen readers announce braille as "dots 1-2-3-4-5-6..." per character — unusable for accessibility. Block-drawing chars are repetitive shapes that screen readers can mute.
- Braille font coverage is inconsistent (Menlo, Courier New, legacy Linux console fonts lack the range). Block-drawing is universally supported.
- Non-UTF-8 locales (`LC_ALL=C`, older SSH sessions) render braille as three question marks per char; block-drawing degrades more gracefully.

The `renderIntro()` function returns a single formatted string, with styling applied inside `wizard/intro.ts` via `chalk`. `NO_COLOR=1` disables ANSI escapes. The banner source itself remains colorless ASCII; the implementation applies color when composing the final intro string.

Iteration is still cheap: re-running the converter with different width/mode arguments produces new candidates, and updating the banner constant in `wizard/intro.ts` is a one-line change. The converter at `tmp/ascii-tool/` is checked in as a design artifact but not imported from application code.

## Risks / Trade-offs

- **New CLI behavior surprises scripted users.** Someone piping `yes | taskless init` in a script will hit a hanging prompt because stdin is still a TTY in some shells.
  → Mitigation: document `--no-interactive` prominently in the release notes and README. Detect obvious non-interactive contexts (no TTY on stderr, `CI` env var set) and auto-flip to `--no-interactive` with a stderr notice.

- **`@clack/prompts` cancel handling is easy to miss.** Every step must call `isCancel()` on its return and bail out; missing one means a Symbol leaks downstream and corrupts state.
  → Mitigation: a small wrapper `ask<T>(fn): Promise<T>` that throws a tagged `WizardCancelled` exception on Symbol, caught at the top level. All steps use the wrapper.

- **Install manifest drift from manual edits.** If a user hand-edits `.claude/skills/` (adds their own file, deletes one of ours), our recorded state becomes inaccurate.
  → Mitigation: the diff summary shows what we _intend_ to remove based on the manifest, not what's currently on disk. On write, we only delete files we recorded — we never touch unknown files in the skills directory. Manual additions survive; manual deletions are re-created (the user can re-delete after wizard exits).

- **Migration 2 in a project with a corrupted `install` object.** If the object exists but is malformed (wrong shape), we could throw during parsing.
  → Mitigation: treat an unparseable `install` object the same way we treat a corrupt manifest — fall back to empty and let the current run rewrite it. Same pattern already used for `version` in migrate.ts.

- **Bundling `cliVersion` at build time means the value is only as current as the bundle.** If someone ships a patched binary, the bundled version is wrong.
  → Mitigation: acceptable — we control the release pipeline and the "patched binary" case isn't real. If it becomes real, switch to runtime `package.json` read; the interface doesn't change.

- **Optional-skill catalog and skill bundle drift.** If someone adds a new skill but forgets to register it in the catalog, the init flow silently drops it.
  → Mitigation: a build-time check that every `SKILL.md` under `skills/` has a corresponding catalog entry. Fail the build otherwise.

## Migration Plan

1. Ship `@clack/prompts` + `picocolors` as dependencies. No runtime impact until wizard code paths are reached.
2. Ship migration 2 in the same release. On first `taskless init` (or any command that runs `ensureTasklessDirectory()`) after upgrade, existing projects' `taskless.json` moves from v1 to v2 with `install: {}`.
3. The first wizard run after upgrade will see an empty install state and compute all current files as additions. No removals on that first run (nothing to diff against), so no extra confirm. Subsequent runs benefit from accurate state.
4. Release notes call out: `taskless` now launches the wizard in a TTY; use `taskless init --no-interactive` in scripts.
5. Rollback: reverting the CLI release returns users to the v1-handling code, which treats an unknown `version: 2` as ahead-of-max and skips migrations (no-op). The `install` field is unused by v1 code but preserved if present (readers ignore unknown fields). No destructive rollback required.

## Open Questions

- **Optional-skill UX for `--no-interactive`.** If a user wants CI in a scripted install, do we add `--skill taskless-ci` (explicit opt-in) or `--with-optional=ci,foo,bar` (group syntax)? Deferred — no scripted CI-install use case exists today.
- **Should `taskless update` also launch the wizard?** Today it's an alias for `init`. The spec keeps it identical — open to splitting later if the semantics diverge.
- **CI skill placeholder content.** The skill file must exist and parse, but the instructional body is OSS-3's domain. For this change, a minimal SKILL.md with frontmatter + a one-line description ("Integrate Taskless into CI — implementation pending") is enough to wire the catalog plumbing.
