## ADDED Requirements

### Requirement: Check accepts positional path arguments

The `check` subcommand SHALL accept zero or more positional path arguments. When zero paths are passed, the CLI SHALL scan the full project directory (existing behavior). When one or more paths are passed, the CLI SHALL forward those paths to `sg scan` so that only the specified files and directories are scanned. Paths SHALL be treated relative to the resolved working directory (`-d` / `process.cwd()`).

Before forwarding, the CLI SHALL silently drop any path that does not exist on disk at invocation time. This lets CI pipelines pipe raw git-diff output directly (e.g. `taskless check $(git diff --name-only main...HEAD)`) without pre-filtering deleted files. If every supplied path is filtered out and the original argument list was non-empty, the CLI SHALL exit with code 0 and print no matches (interpreted as "nothing changed, nothing to scan").

#### Scenario: Zero path arguments scans the whole project

- **WHEN** a user runs `taskless check`
- **THEN** `sg scan` SHALL be invoked without any trailing path arguments
- **AND** the scan SHALL cover the entire resolved working directory

#### Scenario: Explicit paths limit the scan

- **WHEN** a user runs `taskless check src/foo.ts src/bar.ts`
- **AND** both files exist on disk
- **THEN** `sg scan` SHALL be invoked with `src/foo.ts` and `src/bar.ts` as trailing arguments
- **AND** the scan SHALL NOT include files outside those two paths

#### Scenario: Non-existent paths are silently filtered

- **WHEN** a user runs `taskless check src/present.ts src/deleted.ts`
- **AND** `src/present.ts` exists but `src/deleted.ts` does not
- **THEN** the CLI SHALL forward only `src/present.ts` to `sg scan`
- **AND** SHALL NOT error on the missing path

#### Scenario: All paths filtered out exits cleanly

- **WHEN** a user runs `taskless check src/deleted-a.ts src/deleted-b.ts`
- **AND** neither file exists on disk
- **THEN** the CLI SHALL exit with code 0
- **AND** SHALL NOT invoke `sg scan`
- **AND** SHALL report no results (empty results array in JSON mode)

#### Scenario: Relative paths resolve against the working directory

- **WHEN** a user runs `taskless check -d /path/to/project src/foo.ts`
- **AND** `/path/to/project/src/foo.ts` exists
- **THEN** the CLI SHALL treat `src/foo.ts` as relative to `/path/to/project`
- **AND** SHALL forward that relative path to `sg scan` with `cwd = /path/to/project`

#### Scenario: Directory paths are accepted

- **WHEN** a user runs `taskless check src/`
- **AND** `src/` is a directory
- **THEN** the CLI SHALL forward `src/` to `sg scan`
- **AND** the scan SHALL cover files under that directory
