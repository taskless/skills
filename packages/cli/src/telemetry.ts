import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PostHog } from "posthog-node";
import { decodeJwt } from "jose";

import { decodeOrgId } from "./auth/jwt";
import { getConfigDirectory, getToken } from "./auth/token";

const POSTHOG_PROJECT_TOKEN =
  "phc_stymptTiUskp4zM3m9StNSGheHwjskaYagpxV7rDjZyc";
const POSTHOG_HOST = "https://z.taskless.io";

const ANONYMOUS_ID_FILE = "anonymous_id";

export interface TelemetryClient {
  capture(event: string, properties?: Record<string, unknown>): void;
  shutdown(): Promise<void>;
}

function isTelemetryDisabled(): boolean {
  return (
    process.env.TASKLESS_TELEMETRY_DISABLED === "1" ||
    process.env.DO_NOT_TRACK === "1"
  );
}

const noopClient: TelemetryClient = {
  capture() {},
  async shutdown() {},
};

async function getOrCreateAnonymousId(): Promise<string> {
  const configDirectory = getConfigDirectory();
  const filePath = join(configDirectory, ANONYMOUS_ID_FILE);

  try {
    const existing = await readFile(filePath, "utf8");
    const trimmed = existing.trim();
    // Validate it looks like a UUID
    if (
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
        trimmed
      )
    ) {
      return trimmed;
    }
  } catch {
    // File doesn't exist or can't be read
  }

  // Generate a new UUID and persist it
  const id = randomUUID();
  try {
    await mkdir(configDirectory, { recursive: true });
    await writeFile(filePath, id, { mode: 0o600 });
  } catch {
    // Best-effort persistence — continue with the generated ID
  }
  return id;
}

function decodeSubject(token: string): string | undefined {
  try {
    const claims = decodeJwt(token);
    return typeof claims.sub === "string" ? claims.sub : undefined;
  } catch {
    return undefined;
  }
}

let instance: TelemetryClient | undefined;

/**
 * Shut down the telemetry client if it was previously initialized.
 * No-op if getTelemetry() was never called (avoids lazy init just to shut down).
 */
export async function shutdownTelemetry(): Promise<void> {
  if (instance) {
    await instance.shutdown();
  }
}

/**
 * Get the telemetry client, lazily initializing on first call.
 * Subsequent calls return the same instance (cwd is only used on first init).
 */
export async function getTelemetry(cwd?: string): Promise<TelemetryClient> {
  if (instance) return instance;

  if (isTelemetryDisabled()) {
    instance = noopClient;
    return instance;
  }

  let posthog: PostHog | undefined;
  try {
    const anonymousId = await getOrCreateAnonymousId();

    // Resolve identity: prefer JWT subject, fall back to anonymous ID
    let distinctId = anonymousId;
    let anonymous = true;
    let orgId: number | undefined;

    const token = await getToken(cwd, { silent: true });
    if (token) {
      const sub = decodeSubject(token);
      if (sub) {
        distinctId = sub;
        anonymous = false;
      }
      orgId = decodeOrgId(token);
    }

    posthog = new PostHog(POSTHOG_PROJECT_TOKEN, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });

    // Identify the user/device
    posthog.identify({ distinctId, properties: { cli: anonymousId } });

    // Group identify for authenticated users with an org
    if (!anonymous && orgId !== undefined) {
      posthog.groupIdentify({
        groupType: "organization",
        groupKey: String(orgId),
      });
    }

    const ph = posthog;
    instance = {
      capture(event: string, properties?: Record<string, unknown>) {
        try {
          ph.capture({
            distinctId,
            event,
            properties: {
              ...properties,
              cli: anonymousId,
            },
            ...(!anonymous && orgId !== undefined
              ? { groups: { organization: String(orgId) } }
              : {}),
          });
        } catch {
          // Telemetry failures are silent
        }
      },
      async shutdown() {
        try {
          await ph.shutdown();
        } catch {
          // Telemetry failures are silent
        }
      },
    };
  } catch {
    // Clean up partially-created client to avoid open handles
    if (posthog) {
      try {
        await posthog.shutdown();
      } catch {
        // Best-effort cleanup
      }
    }
    instance = noopClient;
  }

  return instance;
}
