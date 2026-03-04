import { getApiBaseUrl } from "./api-config";

export interface WhoamiOrg {
  orgId: number;
  name: string;
  installationId: number;
}

export interface WhoamiResponse {
  user: string;
  email: string;
  orgs: WhoamiOrg[];
}

/** Fetch identity info for the current token. Returns undefined on failure. */
export async function fetchWhoami(
  token: string
): Promise<WhoamiResponse | undefined> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/whoami`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as WhoamiResponse;
  } catch {
    return undefined;
  }
}
