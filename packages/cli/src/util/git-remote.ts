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
