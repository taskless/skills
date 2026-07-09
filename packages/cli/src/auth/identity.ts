import { getToken } from "./token";
import { resolveOrgSubject } from "./org";
import { resolveRepositoryUrl } from "../util/git-remote";
import { getCliPrefix } from "../util/package-manager";

export interface Identity {
  token: string;
  /**
   * Org subject to send on write calls: the current org's Taskless UUID
   * (preferred) or the deprecated numeric `orgId` claim. See `resolveOrgSubject`.
   */
  orgSubject: string | number;
  repositoryUrl: string;
}

/**
 * Resolve the current user's identity for a write call.
 * - orgSubject: the current org's Taskless UUID matched from `whoami` + the
 *   repo's remotes, falling back to the token's deprecated numeric `orgId` claim
 * - repositoryUrl: inferred from `git remote get-url origin`
 *
 * Throws if auth is missing, no org subject can be determined, or the git
 * remote is unavailable.
 */
export async function resolveIdentity(cwd: string): Promise<Identity> {
  const token = await getToken(cwd);
  if (!token) {
    throw new Error(
      `Authentication required. Run \`${getCliPrefix()} auth login\` to authenticate.`
    );
  }

  const repositoryUrl = await resolveRepositoryUrl(cwd);

  const orgSubject = await resolveOrgSubject(cwd, token);
  if (orgSubject === undefined) {
    throw new Error(
      `Your auth token is missing organization info. Run \`${getCliPrefix()} auth login\` to re-authenticate.`
    );
  }

  return { token, orgSubject, repositoryUrl };
}
