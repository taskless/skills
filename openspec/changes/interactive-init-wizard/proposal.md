## Why

The current `taskless init` is a non-interactive batch installer: it detects AI tools, writes every skill into every detected location, and prints a summary. Users can't decline a detected location, can't opt in to optional skills (like CI), and get no context on whether they should authenticate. Running bare `taskless` shows generic help instead of guiding first-time users. As the skill catalog grows (starting with the CI skill from OSS-3/TSKL-214), we need an init flow that presents choices instead of silently installing everything — and we need to record what we installed so re-runs can surgically update instead of glob-replace. Adding a wizard is also the first time we'll surface the difference between authenticated and anonymous usage to users at a moment they can act on it.

Separately, we have no way to answer "which CLI version is running in the wild?" — a gap that has started to block deprecation planning. Adding `cliVersion` and `scaffoldVersion` to every telemetry event is a small, adjacent change that unlocks that visibility.

## What Changes

- Replace the non-interactive `taskless init` with a `@clack/prompts` wizard that runs by default.
- **BREAKING**: Bare `taskless` (no subcommand) now delegates to `init` instead of printing top-level help. `taskless help` remains the way to see top-level help.
- Wizard step — install locations: multi-select all known locations (`.claude/`, `.opencode/`, `.cursor/`, `.agents/`), pre-checking the ones detected in the project root. Wizard errors if the user selects zero.
- Wizard step — optional skills: multi-select optional skills, pre-unchecked. Only entry for this release is the `taskless-ci` skill.
- Wizard step — auth explanation: a short screen describing the tradeoff (authed rules retain conversation history across teammates, enabling rule provenance) followed by a blocking "log in now?" prompt that reuses the same device-code flow as `taskless auth login`.
- Wizard step — install + summary: print a diff against the previously-recorded install state (what will be added, what will be removed), ask for clack `confirm()` before any removals, then write.
- Add `--no-interactive` flag to `init` that preserves today's behavior exactly: install all mandatory skills to all detected locations, no optional skills, no prompts, no auth step. Used by CI and scripted installs.
- Ctrl-C / cancel at any wizard step aborts cleanly with no filesystem writes.
- Intro renders an ASCII Taskless wordmark with `picocolors` coloring. Exact ASCII art will be iterated post-merge; the initial commit uses a placeholder.
- Add `install` object to `.taskless/taskless.json`, keyed by target location, recording the skills and commands written to each. Persisted across runs so re-invocations can compute a diff.
- Add migration `2` that initializes an empty `install: {}` object when an existing `taskless.json` is migrated forward.
- Add the `taskless-ci` skill to the embedded skill bundle. The skill body teaches agents two reusable patterns — full-scan and diff-scan — and directs them to integrate with whichever CI system the user already runs (GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure Pipelines, Bitbucket Pipelines, or any other CI system the agent recognizes) by writing a standalone, non-destructive config. The skill does NOT register a slash command.
- Add `cliVersion` (from `packages/cli/package.json`) and `scaffoldVersion` (from `.taskless/taskless.json`) as standard properties attached to every `posthog.capture()` event.
- Add two new analytics events: `cli_init_completed` (rich payload: `locations`, `optionalSkills`, `authPromptShown`, `authCompleted`, `nonInteractive`, `durationMs`) and `cli_init_cancelled` (`atStep`).
- Add positional path arguments to `taskless check`. When one or more paths are passed (e.g. `taskless check src/foo.ts src/bar.ts`), the scanner runs against only those paths; zero paths preserves the current behavior of scanning the full project. Paths that do not exist on disk (e.g. deleted files in a git diff) are silently filtered so CI pipelines can pipe raw diff output without pre-filtering. Required by the forthcoming CI skill (OSS-3) which will generate workflow files that invoke `taskless check $(git diff --name-only …)` for PR-only scanning.

## Capabilities

### New Capabilities

- `skill-ci`: A new skill (`taskless-ci`) that teaches agents how to wire Taskless into a developer CI pipeline. The skill covers full-scan and diff-scan patterns, non-destructive config generation (standalone files, never editing the user's existing CI config), no-auth defaults, and a gate that refuses to write CI config when no rules exist. Lists common CI systems as detection hints without restricting the skill to a fixed enumeration.

### Modified Capabilities

- `cli-init`: The existing batch installer becomes interactive by default. New requirements cover the wizard prompt sequence, `--no-interactive` flag semantics, wizard cancel behavior, optional-skill selection, install-state diffing, and the new requirement that bare `taskless` delegates to `init`.
- `cli-taskless-bootstrap`: Adds migration `2` which seeds `install: {}` in `taskless.json`. Also extends the manifest schema requirement so readers know `install` is a recognized top-level field.
- `analytics`: Every `capture()` SHALL include `cliVersion` and `scaffoldVersion` properties. Adds `cli_init_completed` and `cli_init_cancelled` to the event table.
- `cli-check`: Adds a new requirement that `taskless check` accepts positional path arguments. Zero paths preserves the full-project scan (existing behavior). One or more paths scans only those paths. Non-existent paths are silently filtered so git-diff output can be piped directly. Required by the upcoming CI skill which generates workflow files that invoke `taskless check` with diff-only paths for PR scanning.

## Impact

- **Code**: `packages/cli/src/commands/init.ts` rewritten; new files under `packages/cli/src/wizard/` for the clack steps; shared `loginInteractive()` extracted from `packages/cli/src/commands/auth.ts` and reused by the wizard; `packages/cli/src/install/install.ts` updated to accept an explicit target list and to read/write the install manifest; `packages/cli/src/filesystem/migrate.ts` gets migration `2`; `packages/cli/src/telemetry.ts` reads `package.json` + `taskless.json` versions at init and attaches them as super-properties.
- **Dependencies**: add `@clack/prompts`, `picocolors` (already a transitive dep of clack, lift to direct dep).
- **CLI UX**: `taskless` (no args) now launches the wizard. Scripted/CI users MUST add `--no-interactive` to `taskless init`. Release notes will call this out.
- **New skill in bundle**: `skills/taskless-ci/SKILL.md` (placeholder body for this change; real body in OSS-3).
- **Manifest schema**: `.taskless/taskless.json` version bumps from 1 to 2 on first run after upgrade.
- **Analytics**: PostHog dashboards will see new `cliVersion` / `scaffoldVersion` properties on every event from upgraded clients; historical events will lack them.
