import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureSpy = vi.fn();
vi.mock("../src/telemetry", () => ({
  getTelemetry: () =>
    Promise.resolve({ capture: captureSpy, shutdown: () => Promise.resolve() }),
  shutdownTelemetry: () => Promise.resolve(),
}));

const fakeCancelSymbol = Symbol("cancel");

// Clack mock responses are set per-test via these mutable refs.
const clackResponses: {
  locations?: string[] | symbol;
  auth?: boolean | symbol;
  summary?: boolean | symbol;
} = {};

vi.mock("@clack/prompts", () => ({
  intro: () => {},
  outro: () => {},
  cancel: () => {},
  log: {
    info: () => {},
    message: () => {},
    error: () => {},
    warn: () => {},
  },
  note: () => {},
  isCancel: (value: unknown) => value === fakeCancelSymbol,
  multiselect: vi.fn(() => Promise.resolve(clackResponses.locations)),
  confirm: vi.fn(({ message }: { message: string }) => {
    if (message.toLowerCase().includes("log in")) {
      return Promise.resolve(clackResponses.auth);
    }
    return Promise.resolve(clackResponses.summary);
  }),
}));

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "taskless-wizard-e2e-"));
  await mkdir(join(cwd, ".claude"), { recursive: true });
  captureSpy.mockClear();
  clackResponses.locations = undefined;
  clackResponses.auth = undefined;
  clackResponses.summary = undefined;
  vi.stubEnv("TASKLESS_TOKEN", "stub-token");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(cwd, { recursive: true, force: true });
  vi.resetModules();
});

describe("runWizard end-to-end", () => {
  it("installs all bundled skills to selected location and records manifest", async () => {
    clackResponses.locations = [".claude"];
    clackResponses.summary = true;

    const { runWizard } = await import("../src/wizard");
    const result = await runWizard({ cwd });

    expect(result.status).toBe("completed");
    expect(result.locations).toEqual([".claude"]);
    expect(result.optionalSkills).toEqual([]);

    expect(
      await exists(join(cwd, ".claude", "skills", "taskless", "SKILL.md"))
    ).toBe(true);

    const manifest = JSON.parse(
      await readFile(join(cwd, ".taskless", "taskless.json"), "utf8")
    ) as {
      version: number;
      install: { targets: Record<string, { skills: string[] }> };
    };
    expect(manifest.install.targets[".claude"]?.skills).toContain("taskless");

    expect(captureSpy).toHaveBeenCalledWith(
      "cli_init_completed",
      expect.objectContaining({
        locations: [".claude"],
        optionalSkills: [],
        nonInteractive: false,
      })
    );
  });

  it("re-running with the same location is idempotent", async () => {
    clackResponses.locations = [".claude"];
    clackResponses.summary = true;

    const { runWizard } = await import("../src/wizard");
    await runWizard({ cwd });
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless", "SKILL.md"))
    ).toBe(true);

    // Re-run with the same selection — no diff, should complete cleanly.
    await runWizard({ cwd });
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless", "SKILL.md"))
    ).toBe(true);
  });

  it("cancelling at locations step writes nothing and emits cli_init_cancelled", async () => {
    clackResponses.locations = fakeCancelSymbol;

    const { runWizard } = await import("../src/wizard");
    const result = await runWizard({ cwd });

    expect(result.status).toBe("cancelled");
    expect(result.cancelledStep).toBe("locations");

    expect(await exists(join(cwd, ".claude", "skills", "taskless"))).toBe(
      false
    );
    expect(await exists(join(cwd, ".taskless", "taskless.json"))).toBe(false);

    expect(captureSpy).toHaveBeenCalledWith(
      "cli_init_cancelled",
      expect.objectContaining({ atStep: "locations" })
    );
  });

  it("cancelling the summary confirm writes nothing", async () => {
    clackResponses.locations = [".claude"];
    clackResponses.summary = false;

    // Seed install state with a stale skill name that is no longer in the
    // bundle so the next wizard run computes a removal and shows the
    // summary confirm. We don't actually need the file on disk — the diff
    // computation reads the manifest, not the filesystem.
    const { ensureTasklessDirectory } =
      await import("../src/filesystem/directory");
    await ensureTasklessDirectory(cwd);
    const { writeInstallState } = await import("../src/install/state");
    await writeInstallState(cwd, {
      installedAt: "2026-05-10T00:00:00.000Z",
      cliVersion: "0.5.4",
      targets: {
        ".claude": {
          skills: ["taskless-removed-fixture-skill"],
          commands: [],
        },
      },
    });

    const { runWizard } = await import("../src/wizard");
    const result = await runWizard({ cwd });
    expect(result.status).toBe("cancelled");
    expect(result.cancelledStep).toBe("summary");
  });
});
