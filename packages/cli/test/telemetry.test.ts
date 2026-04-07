import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock posthog-node before importing telemetry
const mockCapture = vi.fn();
const mockIdentify = vi.fn();
const mockGroupIdentify = vi.fn();
const mockShutdown = vi.fn<() => Promise<void>>();
mockShutdown.mockResolvedValue();

vi.mock("posthog-node", () => {
  return {
    PostHog: class {
      capture = mockCapture;
      identify = mockIdentify;
      groupIdentify = mockGroupIdentify;
      shutdown = mockShutdown;
    },
  };
});

/** Create a minimal JWT with arbitrary claims */
function makeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url"
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.`;
}

/** Write a fake auth token file to a temp project directory */
async function writeTokenFile(cwd: string, token: string): Promise<void> {
  const directory = join(cwd, ".taskless");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, ".env.local.json"),
    JSON.stringify({
      access_token: token,
      expires_at: Date.now() + 60_000,
    })
  );
}

let getTelemetry: (cwd?: string) => Promise<{
  capture: (event: string, properties?: Record<string, unknown>) => void;
  shutdown: () => Promise<void>;
}>;
let configDirectory: string;

beforeEach(async () => {
  // Reset module-level singleton between tests
  vi.resetModules();
  const telemetryModule = await import("../src/telemetry");
  getTelemetry = telemetryModule.getTelemetry;

  // Reset mocks
  mockCapture.mockClear();
  mockIdentify.mockClear();
  mockGroupIdentify.mockClear();
  mockShutdown.mockClear();

  // Create a temp XDG config directory
  configDirectory = await mkdtemp(join(tmpdir(), "taskless-telemetry-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", configDirectory);

  // Ensure telemetry is enabled (empty string != "1", so checks pass)
  vi.stubEnv("TASKLESS_TELEMETRY_DISABLED", "");
  vi.stubEnv("DO_NOT_TRACK", "");
  vi.stubEnv("TASKLESS_TOKEN", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(configDirectory, { recursive: true, force: true });
});

describe("telemetry disabled", () => {
  it("returns no-op stub when TASKLESS_TELEMETRY_DISABLED=1", async () => {
    vi.stubEnv("TASKLESS_TELEMETRY_DISABLED", "1");
    const telemetry = await getTelemetry();

    telemetry.capture("cli_check");
    await telemetry.shutdown();

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockShutdown).not.toHaveBeenCalled();
  });

  it("returns no-op stub when DO_NOT_TRACK=1", async () => {
    vi.stubEnv("DO_NOT_TRACK", "1");
    const telemetry = await getTelemetry();

    telemetry.capture("cli_check");
    await telemetry.shutdown();

    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe("anonymous identity", () => {
  it("generates a UUID v4 on first call and persists it", async () => {
    await getTelemetry();

    const idPath = join(configDirectory, "taskless", "anonymous_id");
    const id = await readFile(idPath, "utf8");
    expect(id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
    );
  });

  it("reads existing anonymous ID on subsequent calls", async () => {
    const existingId = "12345678-1234-4123-8123-123456789abc";
    const tasklessDirectory = join(configDirectory, "taskless");
    await mkdir(tasklessDirectory, { recursive: true });
    await writeFile(join(tasklessDirectory, "anonymous_id"), existingId);

    await getTelemetry();

    expect(mockIdentify).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: existingId,
        properties: { cli: existingId },
      })
    );
  });

  it("creates the config directory if missing", async () => {
    // Point to a non-existent subdirectory
    const freshDirectory = join(configDirectory, "fresh-xdg");
    vi.stubEnv("XDG_CONFIG_HOME", freshDirectory);

    await getTelemetry();

    const idPath = join(freshDirectory, "taskless", "anonymous_id");
    const id = await readFile(idPath, "utf8");
    expect(id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
    );
  });

  it("regenerates UUID when file contains invalid content", async () => {
    const tasklessDirectory = join(configDirectory, "taskless");
    await mkdir(tasklessDirectory, { recursive: true });
    await writeFile(join(tasklessDirectory, "anonymous_id"), "not-a-uuid");

    await getTelemetry();

    const id = await readFile(join(tasklessDirectory, "anonymous_id"), "utf8");
    expect(id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
    );
    expect(id).not.toBe("not-a-uuid");
  });
});

describe("authenticated identity", () => {
  it("uses JWT sub as distinctId when JWT is available", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "taskless-auth-test-"));
    try {
      const jwt = makeJwt({ sub: "user-123", orgId: 42 });
      await writeTokenFile(cwd, jwt);

      const telemetry = await getTelemetry(cwd);
      telemetry.capture("cli_check");

      expect(mockIdentify).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "user-123",
        })
      );
      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "user-123",
          groups: { organization: "42" },
        })
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("calls groupIdentify with orgId when authenticated", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "taskless-auth-test-"));
    try {
      const jwt = makeJwt({ sub: "user-456", orgId: 99 });
      await writeTokenFile(cwd, jwt);

      await getTelemetry(cwd);

      expect(mockGroupIdentify).toHaveBeenCalledWith({
        groupType: "organization",
        groupKey: "99",
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("falls back to anonymous UUID when no JWT is available", async () => {
    const telemetry = await getTelemetry();
    telemetry.capture("cli_check");

    // distinctId should be the anonymous UUID, not a JWT sub
    const captureArgument = mockCapture.mock.calls[0]![0] as {
      distinctId: string;
    };
    expect(captureArgument.distinctId).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
    );
    expect(mockGroupIdentify).not.toHaveBeenCalled();
  });
});

describe("capture", () => {
  it("includes cli property on every event", async () => {
    const telemetry = await getTelemetry();
    telemetry.capture("cli_check");

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          cli: expect.stringMatching(
            /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
          ) as string,
        }) as Record<string, unknown>,
      })
    );
  });

  it("merges custom properties with standard properties", async () => {
    const telemetry = await getTelemetry();
    telemetry.capture("cli_check", { foo: "bar" });

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cli_check",
        properties: expect.objectContaining({
          cli: expect.any(String) as string,
          foo: "bar",
        }) as Record<string, unknown>,
      })
    );
  });

  it("does not include groups when unauthenticated", async () => {
    const telemetry = await getTelemetry();
    telemetry.capture("cli_check");

    const captureArgument = mockCapture.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(captureArgument).not.toHaveProperty("groups");
  });
});

describe("singleton", () => {
  it("returns the same instance on subsequent calls", async () => {
    const first = await getTelemetry();
    const second = await getTelemetry();
    expect(first).toBe(second);
  });
});

describe("shutdown", () => {
  it("calls posthog.shutdown()", async () => {
    const telemetry = await getTelemetry();
    await telemetry.shutdown();
    expect(mockShutdown).toHaveBeenCalledOnce();
  });
});
