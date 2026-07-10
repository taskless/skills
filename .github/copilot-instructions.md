# Copilot review instructions

Repo-wide guidance for automated code review. Prioritize correctness and
security over style. Be specific and actionable; cite the file and line.

## GitHub Actions — credential & secret safety (review with extra scrutiny)

Workflows under `.github/workflows/` can hold high-value credentials
(`GITHUB_TOKEN`, `NPM_TOKEN`, OIDC identities, deploy keys). Treat any change to
them as security-sensitive and flag the following:

- **`pull_request_target` + PR-controlled code or secrets.** Flag any
  `pull_request_target` (or `workflow_run`) workflow that checks out the PR head
  and then builds/tests it, or exposes secrets to it. A fork PR can then run its
  own code with the base repo's token. Prefer `pull_request` (forks get a
  read-only token and no secrets).
- **Untrusted `${{ }}` interpolated into `run:`.** Flag any expression carrying
  attacker-controllable text — `github.event.pull_request.title`/`.body`,
  `.head_commit.message`, `.head_ref`/branch names, issue/comment/review bodies —
  substituted directly into a shell `run:` step. That is command injection.
  Require it be passed via `env:` and referenced as a quoted `"$VAR"`, or handled
  in `actions/github-script` via `process.env`.
- **Credentials exposed alongside untrusted content.** Flag a job that holds a
  publish/deploy secret AND processes PR- or contributor-authored content
  (changeset text, PR bodies, uploaded artifacts). Prefer splitting into a
  credential-free job that handles untrusted content and a separate credentialed
  job that only runs reviewed, merged source.
- **Over-broad or implicit `permissions:`.** Prefer an explicit least-privilege
  `permissions:` block over relying on the repo/org default token scope, which
  varies by settings and may grant more than the job needs. Flag any grant not
  justified by the job — call out `contents: write`, `id-token: write`,
  `packages: write`, `actions: write` — and prefer setting permissions per job.
- **Unpinned actions.** In any workflow that touches secrets or OIDC, flag
  third-party actions pinned to a tag or branch (`@v4`, `@main`) instead of a
  full commit SHA.
- **Lifecycle scripts under a live credential.** Flag dependency installs that
  run lifecycle scripts (no `--ignore-scripts`) in a job that holds a publish
  token or OIDC identity — a malicious/compromised dependency could exfiltrate
  it. Prefer `--ignore-scripts` + an explicit, reviewed build step.
- **Long-lived stored tokens.** Where a registry supports it (e.g. npm trusted
  publishing), prefer short-lived OIDC over a stored `NPM_TOKEN`/PAT, and flag
  new long-lived secrets that could be replaced by OIDC.

## Secrets & credentials (all code)

- Flag hardcoded secrets, tokens, private keys, or credentials in source,
  tests, fixtures, or committed config. Never read or echo `.env` / `.dev.vars`
  / `.secrets`.
- Flag logging or error messages that could print a token, Authorization header,
  cookie, or other secret.
