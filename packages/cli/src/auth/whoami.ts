import { createApiClient } from "../api/client";

/** Fetch identity info for the current token. Returns undefined on failure. */
export async function fetchWhoami(token: string) {
  try {
    const client = createApiClient(token);
    const { data, error } = await client.GET("/cli/api/whoami");
    if (error) return;
    return data;
  } catch {
    return;
  }
}
