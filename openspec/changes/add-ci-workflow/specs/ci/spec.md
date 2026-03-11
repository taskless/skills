# CI

## Purpose

Defines the GitHub Actions CI workflow that validates the repository on pull requests and main branch pushes.

## ADDED Requirements

### Requirement: CI workflow exists

A GitHub Actions workflow file SHALL exist at `.github/workflows/ci.yml`.

#### Scenario: Workflow file is present

- **WHEN** inspecting the repository
- **THEN** `.github/workflows/ci.yml` SHALL exist and be valid YAML

### Requirement: Workflow triggers on PRs and main pushes

The workflow SHALL trigger on pull requests targeting the `main` branch and on pushes to the `main` branch.

#### Scenario: Pull request triggers workflow

- **WHEN** a pull request is opened or updated targeting `main`
- **THEN** the CI workflow SHALL run

#### Scenario: Push to main triggers workflow

- **WHEN** a commit is pushed to `main`
- **THEN** the CI workflow SHALL run

#### Scenario: Push to non-main branch does not trigger

- **WHEN** a commit is pushed to a branch other than `main` without a PR
- **THEN** the CI workflow SHALL NOT run

### Requirement: Workflow runs lint check

The workflow SHALL run `pnpm lint` and the job SHALL fail if linting reports errors.

#### Scenario: Lint passes

- **WHEN** the codebase has no lint errors
- **THEN** the lint step SHALL succeed

#### Scenario: Lint fails

- **WHEN** the codebase has lint errors
- **THEN** the lint step SHALL fail and the workflow SHALL report failure

### Requirement: Workflow runs type checking

The workflow SHALL run `pnpm typecheck` and the job SHALL fail if type errors are found.

#### Scenario: Type check passes

- **WHEN** all packages have no type errors
- **THEN** the typecheck step SHALL succeed

#### Scenario: Type check fails

- **WHEN** a package has type errors
- **THEN** the typecheck step SHALL fail and the workflow SHALL report failure

### Requirement: Workflow runs build

The workflow SHALL run `pnpm build` and the job SHALL fail if the build fails.

#### Scenario: Build succeeds

- **WHEN** all packages build without errors
- **THEN** the build step SHALL succeed

#### Scenario: Build fails

- **WHEN** a package fails to build
- **THEN** the build step SHALL fail and the workflow SHALL report failure

### Requirement: Workflow runs tests

The workflow SHALL run `pnpm test` and the job SHALL fail if any tests fail.

#### Scenario: Tests pass

- **WHEN** all test suites pass
- **THEN** the test step SHALL succeed

#### Scenario: Tests fail

- **WHEN** a test suite has failures
- **THEN** the test step SHALL fail and the workflow SHALL report failure

### Requirement: Workflow uses pnpm matching packageManager field

The workflow SHALL install pnpm using a version consistent with the `packageManager` field in the root `package.json`.

#### Scenario: pnpm version matches

- **WHEN** the workflow installs dependencies
- **THEN** the pnpm version used SHALL match the version specified in `packageManager`

### Requirement: Workflow uses Node 22

The workflow SHALL use Node.js version 22.

#### Scenario: Node version is 22

- **WHEN** the workflow runs
- **THEN** Node.js 22 SHALL be the active runtime

### Requirement: Workflow does not publish

The workflow SHALL NOT include any publish, release, or npm registry push steps.

#### Scenario: No publish steps

- **WHEN** inspecting the workflow file
- **THEN** there SHALL be no steps that run `pnpm publish`, `npm publish`, or interact with an npm registry
