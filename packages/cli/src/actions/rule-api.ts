import { getApiBaseUrl } from "./api-config";

// --- Request types (stdin-provided fields) ---

/** The fields provided by the user via stdin */
export interface RuleCreateRequest {
  prompt: string;
  language?: string;
  successCase?: string;
  failureCase?: string;
}

/** The full API request body including project config fields */
export interface RuleApiRequest {
  orgId: number;
  repositoryUrl: string;
  prompt: string;
  language?: string;
  successCase?: string;
  failureCase?: string;
}

// --- Response types ---

/** Initial response from POST /cli/api/rule */
export interface RuleSubmitResponse {
  ruleId: string;
  status: "accepted";
}

/** ast-grep rule content */
export interface RuleContent {
  id: string;
  language: string;
  rule: Record<string, unknown>;
  severity?: "hint" | "info" | "warning" | "error" | "off";
  message?: string;
  note?: string;
  fix?: string | Record<string, unknown>;
  constraints?: Record<string, unknown>;
  utils?: Record<string, unknown>;
  transform?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  files?: string[];
  ignores?: string[];
  url?: string;
}

/** Test cases for a generated rule */
export interface RuleTestCase {
  valid: string[];
  invalid: string[];
}

/** A single generated rule from the API */
export interface GeneratedRule {
  id: string;
  content: RuleContent;
  tests?: RuleTestCase;
}

/** Discriminated union for GET /cli/api/rule/:ruleId responses */
export type RuleStatusResponse =
  | { status: "accepted"; ruleId: string }
  | { status: "building"; ruleId: string }
  | {
      status: "generated";
      ruleId: string;
      rules: GeneratedRule[];
    }
  | { status: "failed"; ruleId: string; error: string }
  | { status: "pr" | "merged" | "closed"; ruleId: string };

// --- API error types ---

export type RuleApiError =
  | { error: "validation_error"; details: string[] }
  | { error: "repository_not_accessible" }
  | { error: "organization_not_found" }
  | { error: "request_not_found" }
  | { error: "access_denied" };

// --- Provider interface ---

/** Interface for rule generation API calls */
export interface RuleApiProvider {
  submitRule(
    token: string,
    request: RuleApiRequest
  ): Promise<RuleSubmitResponse>;
  pollRuleStatus(token: string, ruleId: string): Promise<RuleStatusResponse>;
}

// --- HTTP implementation ---

class HttpRuleApiProvider implements RuleApiProvider {
  async submitRule(
    token: string,
    request: RuleApiRequest
  ): Promise<RuleSubmitResponse> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/rule`, {
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
      if (
        response.status === 403 &&
        data.error === "repository_not_accessible"
      ) {
        throw new Error(
          "Repository is not accessible to this organization. Check your orgId and repositoryUrl in .taskless/taskless.json."
        );
      }
      if (response.status === 404 && data.error === "organization_not_found") {
        throw new Error(
          "Organization not found. Check the orgId in .taskless/taskless.json."
        );
      }

      throw new Error(
        `Request submission failed (HTTP ${String(response.status)})`
      );
    }

    return (await response.json()) as RuleSubmitResponse;
  }

  async pollRuleStatus(
    token: string,
    ruleId: string
  ): Promise<RuleStatusResponse> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/rule/${encodeURIComponent(ruleId)}`,
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

      if (response.status === 403 && data.error === "access_denied") {
        throw new Error("Access denied to this request.");
      }
      if (response.status === 404 && data.error === "request_not_found") {
        throw new Error("Request not found. It may have expired.");
      }

      throw new Error(
        `Status polling failed (HTTP ${String(response.status)})`
      );
    }

    return (await response.json()) as RuleStatusResponse;
  }
}

// --- Stub implementation ---

class StubRuleApiProvider implements RuleApiProvider {
  submitRule(): Promise<RuleSubmitResponse> {
    throw new Error(
      "Rule generation is not yet available. The API is under development."
    );
  }

  pollRuleStatus(): Promise<RuleStatusResponse> {
    throw new Error(
      "Rule generation is not yet available. The API is under development."
    );
  }
}

/** Default provider instance — stub until the API ships */
export const ruleApiProvider: RuleApiProvider = process.env.TASKLESS_API_URL
  ? new HttpRuleApiProvider()
  : new StubRuleApiProvider();
