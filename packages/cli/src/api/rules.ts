import type { paths } from "../generated/api";
import { createApiClient } from "./client";
import { getCliPrefix } from "../util/package-manager";

// --- Types extracted from the generated schema ---

type RuleStatusData =
  paths["/cli/api/rule/{ruleId}"]["get"]["responses"]["200"]["content"]["application/json"];

/** A single generated rule from the API */
export type GeneratedRule = NonNullable<RuleStatusData["rules"]>[number];

/** Sidecar metadata keyed by rule filename */
export type RuleMetadata = NonNullable<RuleStatusData["meta"]>;

// --- Helpers ---

/** Extract error details from an untyped error response body */
function parseErrorBody(rawError: unknown): Record<string, unknown> {
  if (rawError && typeof rawError === "object") {
    return rawError as Record<string, unknown>;
  }
  return {};
}

// --- API functions ---

/** Submit a new rule generation request */
export async function submitRule(
  token: string,
  request: {
    orgId: number;
    repositoryUrl: string;
    prompt: string;
    successCases?: string[];
    failureCases?: string[];
  }
) {
  const client = createApiClient(token);
  const { data, error, response } = await client.POST("/cli/api/rule", {
    body: request,
  });

  if (!data) {
    const errorData = parseErrorBody(error);
    if (response.status === 400 && errorData.error === "validation_error") {
      const details = (errorData.details as string[]) ?? [];
      throw new Error(`Validation error: ${details.join(", ")}`);
    }
    if (
      response.status === 403 &&
      errorData.error === "repository_not_accessible"
    ) {
      throw new Error(
        [
          "Repository is not accessible to this organization.",
          "",
          "- Verify that your local `origin` remote points to the intended GitHub repository.",
          "- Confirm that your GitHub user/organization has access to that repository.",
          `- If you recently changed access or remotes, try re-authenticating with \`${getCliPrefix()} auth login\`.`,
        ].join("\n")
      );
    }
    if (
      response.status === 404 &&
      errorData.error === "organization_not_found"
    ) {
      throw new Error(
        `Organization not found. Try running \`${getCliPrefix()} auth login\` to re-authenticate.`
      );
    }
    throw new Error(
      `Request submission failed (HTTP ${String(response.status)})`
    );
  }

  return data;
}

/** Poll for rule generation status */
export async function pollRuleStatus(token: string, ruleId: string) {
  const client = createApiClient(token);
  const { data, error, response } = await client.GET("/cli/api/rule/{ruleId}", {
    params: { path: { ruleId } },
  });

  if (!data) {
    const errorData = parseErrorBody(error);
    if (response.status === 403 && errorData.error === "access_denied") {
      throw new Error("Access denied to this request.");
    }
    if (response.status === 404 && errorData.error === "request_not_found") {
      throw new Error("Request not found. It may have expired.");
    }
    throw new Error(`Status polling failed (HTTP ${String(response.status)})`);
  }

  return data;
}

/** Submit an improve/iterate request for an existing rule */
export async function iterateRule(
  token: string,
  ruleId: string,
  request: {
    orgId: number;
    guidance: string;
    references?: Array<{ filename: string; content: string }>;
  }
) {
  const client = createApiClient(token);
  const { data, error, response } = await client.POST(
    "/cli/api/rule/{ruleId}/iterate",
    {
      params: { path: { ruleId } },
      body: request,
    }
  );

  if (!data) {
    const errorData = parseErrorBody(error);
    if (response.status === 400 && errorData.error === "validation_error") {
      const details = (errorData.details as string[]) ?? [];
      throw new Error(`Validation error: ${details.join(", ")}`);
    }
    if (response.status === 403 && errorData.error === "access_denied") {
      throw new Error("Access denied to this request.");
    }
    if (response.status === 404 && errorData.error === "request_not_found") {
      throw new Error("Rule not found. It may have expired.");
    }
    if (
      response.status === 404 &&
      errorData.error === "organization_not_found"
    ) {
      throw new Error(
        `Organization not found. Try running \`${getCliPrefix()} auth login\` to re-authenticate.`
      );
    }
    throw new Error(`Iterate request failed (HTTP ${String(response.status)})`);
  }

  return data;
}
