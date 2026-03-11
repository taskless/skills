import { getApiBaseUrl } from "./api-config";

// --- Request types ---

/** The request body for POST /cli/api/update-engine */
export interface UpdateRequest {
  orgId: number;
  repositoryUrl: string;
  version: string;
}

// --- Response types ---

/** Discriminated union for POST /cli/api/update-engine responses */
export type UpdateSubmitResponse =
  | { status: "current" }
  | { status: "exists"; requestId: string; prUrl: string }
  | { status: "accepted"; requestId: string };

/** Discriminated union for GET /cli/api/update-engine/:requestId responses */
export type UpdateStatusResponse =
  | { status: "pending" }
  | { status: "open"; prUrl: string }
  | { status: "merged"; prUrl: string }
  | { status: "closed"; prUrl: string };

// --- API error types ---

export type UpdateApiError =
  | { error: "validation_error"; details: string[] }
  | { error: "organization_not_found" }
  | { error: "repository_not_found" }
  | { error: "not_found" }
  | { error: "unauthorized" };

// --- Provider interface ---

/** Interface for update-engine API calls */
export interface UpdateApiProvider {
  submitUpdate(
    token: string,
    request: UpdateRequest
  ): Promise<UpdateSubmitResponse>;
  pollStatus(token: string, requestId: string): Promise<UpdateStatusResponse>;
}

// --- HTTP implementation ---

class HttpUpdateApiProvider implements UpdateApiProvider {
  async submitUpdate(
    token: string,
    request: UpdateRequest
  ): Promise<UpdateSubmitResponse> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/update-engine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (response.status === 400 && data.error === "validation_error") {
        const details = (data.details as string[]) ?? [];
        throw new Error(`Validation error: ${details.join(", ")}`);
      }
      if (response.status === 401) {
        throw new Error(
          "Authentication required. Run `taskless auth login` first."
        );
      }
      if (response.status === 404 && data.error === "organization_not_found") {
        throw new Error(
          "Organization not found. Check the orgId in .taskless/taskless.json."
        );
      }
      if (response.status === 404 && data.error === "repository_not_found") {
        throw new Error(
          "Repository not found. Check the repositoryUrl in .taskless/taskless.json."
        );
      }

      throw new Error(
        `Update request failed (HTTP ${String(response.status)})`
      );
    }

    return (await response.json()) as UpdateSubmitResponse;
  }

  async pollStatus(
    token: string,
    requestId: string
  ): Promise<UpdateStatusResponse> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/update-engine/${encodeURIComponent(requestId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (response.status === 401) {
        throw new Error(
          "Authentication required. Run `taskless auth login` first."
        );
      }
      if (response.status === 404 && data.error === "not_found") {
        throw new Error("Update request not found. It may have expired.");
      }

      throw new Error(
        `Status polling failed (HTTP ${String(response.status)})`
      );
    }

    return (await response.json()) as UpdateStatusResponse;
  }
}

/** Default provider instance */
export const updateApiProvider: UpdateApiProvider = new HttpUpdateApiProvider();
