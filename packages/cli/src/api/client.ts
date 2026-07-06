import createClient from "openapi-fetch";

import type { paths } from "../generated/api";
import { getApiBaseUrl } from "./config";
import { CLI_VERSION, CLI_VERSION_HEADER } from "../version";

/** Create a typed API client for the Taskless CLI API */
export function createApiClient(token: string) {
  // Schema paths include the /cli/ prefix, so the base URL is the origin
  const baseUrl = getApiBaseUrl().replace(/\/cli\/?$/, "");
  return createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      [CLI_VERSION_HEADER]: CLI_VERSION,
    },
  });
}
