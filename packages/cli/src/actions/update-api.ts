import type { paths } from "../generated/api";
import { createApiClient } from "./api-client";

// --- Response types extracted from the generated schema ---

type UpdateSubmitResponse =
  paths["/cli/api/update-engine"]["post"]["responses"]["200"]["content"]["application/json"];

type UpdateStatusResponse =
  paths["/cli/api/update-engine/{requestId}"]["get"]["responses"]["200"]["content"]["application/json"];

/** Extract error details from an untyped error response body */
function parseErrorBody(rawError: unknown): Record<string, unknown> {
  if (rawError && typeof rawError === "object") {
    return rawError as Record<string, unknown>;
  }
  return {};
}

/** Submit a scaffold update request */
export async function submitUpdate(
  token: string,
  request: {
    orgId: number;
    repositoryUrl: string;
    version: string;
  }
): Promise<UpdateSubmitResponse> {
  const client = createApiClient(token);
  const { data, error, response } = await client.POST(
    "/cli/api/update-engine",
    {
      body: request,
    }
  );

  if (!data) {
    const errorData = parseErrorBody(error);
    if (response.status === 400 && errorData.error === "validation_error") {
      const details = (errorData.details as string[]) ?? [];
      throw new Error(`Validation error: ${details.join(", ")}`);
    }
    if (response.status === 401) {
      throw new Error(
        "Authentication required. Run `taskless auth login` first."
      );
    }
    if (
      response.status === 404 &&
      errorData.error === "organization_not_found"
    ) {
      throw new Error(
        "Organization not found. Check the orgId in .taskless/taskless.json."
      );
    }
    if (response.status === 404 && errorData.error === "repository_not_found") {
      throw new Error(
        "Repository not found. Check the repositoryUrl in .taskless/taskless.json."
      );
    }
    throw new Error(`Update request failed (HTTP ${String(response.status)})`);
  }

  return data;
}

/** Poll for scaffold update status */
export async function pollUpdateStatus(
  token: string,
  requestId: string
): Promise<UpdateStatusResponse> {
  const client = createApiClient(token);
  const { data, error, response } = await client.GET(
    "/cli/api/update-engine/{requestId}",
    {
      params: { path: { requestId } },
    }
  );

  if (!data) {
    const errorData = parseErrorBody(error);
    if (response.status === 401) {
      throw new Error(
        "Authentication required. Run `taskless auth login` first."
      );
    }
    if (response.status === 404 && errorData.error === "not_found") {
      throw new Error("Update request not found. It may have expired.");
    }
    throw new Error(`Status polling failed (HTTP ${String(response.status)})`);
  }

  return data;
}
