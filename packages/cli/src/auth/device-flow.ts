import { getApiBaseUrl } from "../api/config";

const CLIENT_ID = "taskless-cli";

/** Response from the device authorization endpoint */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

/** Successful token response */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

/** Pending/error states from the token endpoint */
export type TokenPollResult =
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "success"; token: TokenResponse }
  | { status: "expired" }
  | { status: "denied" };

/** Interface for the Device Flow HTTP calls */
export interface DeviceFlowProvider {
  requestDeviceCode(): Promise<DeviceCodeResponse>;
  pollForToken(deviceCode: string): Promise<TokenPollResult>;
}

class HttpDeviceFlowProvider implements DeviceFlowProvider {
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Device authorization failed (HTTP ${String(response.status)})${text ? `: ${text}` : ""}`
      );
    }

    return (await response.json()) as DeviceCodeResponse;
  }

  async pollForToken(deviceCode: string): Promise<TokenPollResult> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Token polling failed (HTTP ${String(response.status)})${text ? `: ${text}` : ""}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;

    if ("error" in data) {
      switch (data.error) {
        case "authorization_pending": {
          return { status: "pending" };
        }
        case "slow_down": {
          return { status: "slow_down" };
        }
        case "expired_token": {
          return { status: "expired" };
        }
        case "access_denied": {
          return { status: "denied" };
        }
        default: {
          throw new Error(`Unexpected auth error: ${String(data.error)}`);
        }
      }
    }

    return {
      status: "success",
      token: data as unknown as TokenResponse,
    };
  }
}

/** Default provider instance */
export const deviceFlowProvider: DeviceFlowProvider =
  new HttpDeviceFlowProvider();
