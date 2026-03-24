import createClient from "openapi-fetch";

import type { paths } from "../generated/api";
import { getApiBaseUrl } from "./api-config";

/** Create a typed API client for the Taskless CLI API */
export function createApiClient(token: string) {
  // Schema paths include the /cli/ prefix, so the base URL is the origin
  const baseUrl = getApiBaseUrl().replace(/\/cli\/?$/, "");
  return createClient<paths>({
    baseUrl,
    headers: { Authorization: `Bearer ${token}` },
  });
}
