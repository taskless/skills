import { execFile } from "node:child_process";

/**
 * Resolve the repository URL from `git remote get-url origin`,
 * canonicalized to `https://github.com/{owner}/{repo}`.
 */
export async function resolveRepositoryUrl(cwd: string): Promise<string> {
  const rawUrl = await getOriginUrl(cwd);
  return canonicalizeGitHubUrl(rawUrl);
}

function getOriginUrl(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["remote", "get-url", "origin"],
      { cwd },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              "Could not determine repository URL from git remote. Ensure your repository has an 'origin' remote pointing to GitHub."
            )
          );
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

// git@github.com:owner/repo.git or git@github.com:owner/repo
const SSH_PATTERN = /^git@github\.com:(?<path>[^/]+\/[^/]+?)(?:\.git)?$/;
// https://github.com/owner/repo.git or https://github.com/owner/repo
const HTTPS_PATTERN =
  /^https:\/\/github\.com\/(?<path>[^/]+\/[^/]+?)(?:\.git)?$/;

/** @internal Exported for testing only */
export function canonicalizeGitHubUrl(rawUrl: string): string {
  const sshMatch = SSH_PATTERN.exec(rawUrl);
  if (sshMatch?.groups?.path) {
    return `https://github.com/${sshMatch.groups.path}`;
  }

  const httpsMatch = HTTPS_PATTERN.exec(rawUrl);
  if (httpsMatch?.groups?.path) {
    return `https://github.com/${httpsMatch.groups.path}`;
  }

  throw new Error(
    `Unsupported git remote URL: "${rawUrl}". Only GitHub repositories (github.com) are supported.`
  );
}

// git@github.com:owner/repo(.git) — owner only
const OWNER_SSH_PATTERN =
  /^git@github\.com:(?<owner>[^/]+)\/[^/]+?(?:\.git)?$/i;
// http(s)://[user@][www.]github.com/owner/repo(.git)(/) — owner only
const OWNER_HTTPS_PATTERN =
  /^https?:\/\/(?:[^@/]+@)?(?:www\.)?github\.com\/(?<owner>[^/]+)\/[^/]+?(?:\.git)?\/?$/i;

/**
 * Reduce a GitHub remote URL to its canonical OWNER url —
 * `https://github.com/{owner}` — matching the server's `orgs[].url`
 * normalization exactly: scheme `https`, host `github.com` (no `www.`), owner
 * lowercased, repo dropped, no `.git`, no trailing slash, no userinfo.
 * Throws for anything that isn't a GitHub owner/repo remote.
 */
export function canonicalOwnerUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  const match = OWNER_SSH_PATTERN.exec(url) ?? OWNER_HTTPS_PATTERN.exec(url);
  if (!match?.groups?.owner) {
    throw new Error(
      `Unsupported git remote URL: "${rawUrl}". Only GitHub repositories (github.com) are supported.`
    );
  }
  return `https://github.com/${match.groups.owner.toLowerCase()}`;
}

/** Read every `remote.<name>.url` from git config; empty if not a repo / no remotes. */
function listRemoteConfig(
  cwd: string
): Promise<{ name: string; url: string }[]> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["config", "--get-regexp", String.raw`^remote\..*\.url$`],
      { cwd },
      (error, stdout) => {
        if (error) {
          resolve([]); // not a repo, no remotes, or git unavailable → no context
          return;
        }
        const remotes: { name: string; url: string }[] = [];
        for (const line of stdout.split("\n")) {
          // `remote.<name>.url <url>` — name may contain dots, so match greedily
          // up to the final `.url` before the value.
          const match = /^remote\.(?<name>.+)\.url\s+(?<url>.+)$/.exec(
            line.trim()
          );
          if (match?.groups?.name && match.groups.url) {
            remotes.push({ name: match.groups.name, url: match.groups.url });
          }
        }
        resolve(remotes);
      }
    );
  });
}

/** Remotes we trust most, in order, before falling back to config order. */
const REMOTE_PRECEDENCE = ["origin", "upstream"];

/**
 * The repo's canonical OWNER urls, ordered `origin` → `upstream` → remaining
 * remotes in config order, de-duplicated. Non-GitHub remotes are skipped. Used
 * to pick the acting org by matching against `whoami` `orgs[].url`.
 */
export async function listRemoteOwnerUrls(cwd: string): Promise<string[]> {
  const remotes = await listRemoteConfig(cwd);
  const ordered = [
    ...REMOTE_PRECEDENCE.map((name) =>
      remotes.find((remote) => remote.name === name)
    ).filter((remote) => remote !== undefined),
    ...remotes.filter((remote) => !REMOTE_PRECEDENCE.includes(remote.name)),
  ];

  const owners: string[] = [];
  const seen = new Set<string>();
  for (const remote of ordered) {
    let owner: string;
    try {
      owner = canonicalOwnerUrl(remote.url);
    } catch {
      continue; // non-GitHub remote — can't map to an org
    }
    if (!seen.has(owner)) {
      seen.add(owner);
      owners.push(owner);
    }
  }
  return owners;
}
