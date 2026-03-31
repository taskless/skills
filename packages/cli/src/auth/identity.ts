import { getToken } from "./token";
import { decodeOrgId } from "./jwt";
import { resolveRepositoryUrl } from "../util/git-remote";

export interface Identity {
  token: string;
  orgId: number;
  repositoryUrl: string;
}

/**
 * Resolve the current user's identity from JWT claims and git remote.
 * - orgId: extracted from the JWT's orgId claim
 * - repositoryUrl: inferred from `git remote get-url origin`
 *
 * Throws if auth is missing, the JWT lacks orgId, or the git remote is unavailable.
 */
export async function resolveIdentity(cwd: string): Promise<Identity> {
  const token = await getToken(cwd);
  if (!token) {
    throw new Error(
      "Authentication required. Run `taskless auth login` to authenticate."
    );
  }

  const orgId = decodeOrgId(token);
  if (orgId === undefined) {
    throw new Error(
      "Your auth token is missing organization info. Run `taskless auth login` to re-authenticate."
    );
  }

  const repositoryUrl = await resolveRepositoryUrl(cwd);

  return { token, orgId, repositoryUrl };
}
