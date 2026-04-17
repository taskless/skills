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
  optionalSkills?: string[] | symbol;
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
  multiselect: vi.fn(({ message }: { message: string }) => {
    if (message.toLowerCase().includes("install")) {
      return Promise.resolve(clackResponses.locations);
    }
    return Promise.resolve(clackResponses.optionalSkills);
  }),
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
  clackResponses.optionalSkills = undefined;
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
  it("installs selected location + optional skill and records manifest", async () => {
    clackResponses.locations = [".claude"];
    clackResponses.optionalSkills = ["taskless-ci"];
    clackResponses.summary = true;

    const { runWizard } = await import("../src/wizard");
    const result = await runWizard({ cwd });

    expect(result.status).toBe("completed");
    expect(result.locations).toEqual([".claude"]);
    expect(result.optionalSkills).toEqual(["taskless-ci"]);

    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-check", "SKILL.md"))
    ).toBe(true);
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-ci", "SKILL.md"))
    ).toBe(true);

    const manifest = JSON.parse(
      await readFile(join(cwd, ".taskless", "taskless.json"), "utf8")
    ) as {
      version: number;
      install: { targets: Record<string, { skills: string[] }> };
    };
    expect(manifest.install.targets[".claude"]?.skills).toContain(
      "taskless-check"
    );
    expect(manifest.install.targets[".claude"]?.skills).toContain(
      "taskless-ci"
    );

    expect(captureSpy).toHaveBeenCalledWith(
      "cli_init_completed",
      expect.objectContaining({
        locations: [".claude"],
        optionalSkills: ["taskless-ci"],
        nonInteractive: false,
      })
    );
  });

  it("surgically removes a previously-installed optional skill on re-run", async () => {
    clackResponses.locations = [".claude"];
    clackResponses.optionalSkills = ["taskless-ci"];
    clackResponses.summary = true;

    const { runWizard } = await import("../src/wizard");
    await runWizard({ cwd });
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-ci", "SKILL.md"))
    ).toBe(true);

    // Re-run: drop taskless-ci
    clackResponses.optionalSkills = [];
    clackResponses.summary = true;
    await runWizard({ cwd });

    expect(await exists(join(cwd, ".claude", "skills", "taskless-ci"))).toBe(
      false
    );
    expect(await exists(join(cwd, ".claude", "skills", "taskless-check"))).toBe(
      true
    );
  });

  it("cancelling at locations step writes nothing and emits cli_init_cancelled", async () => {
    clackResponses.locations = fakeCancelSymbol;

    const { runWizard } = await import("../src/wizard");
    const result = await runWizard({ cwd });

    expect(result.status).toBe("cancelled");
    expect(result.cancelledStep).toBe("locations");

    expect(await exists(join(cwd, ".claude", "skills", "taskless-check"))).toBe(
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
    clackResponses.optionalSkills = ["taskless-ci"];
    // Simulate previous install of taskless-ci so the re-run has removals
    // that trigger the summary confirm.
    clackResponses.summary = false;

    const { runWizard, applyInstallPlan } = await import("../src/wizard").then(
      async () => {
        const wizard = await import("../src/wizard");
        const install = await import("../src/install/install");
        return {
          runWizard: wizard.runWizard,
          applyInstallPlan: install.applyInstallPlan,
        };
      }
    );

    // Seed an earlier install so the diff has removals on the next wizard run
    const { ensureTasklessDirectory } =
      await import("../src/filesystem/directory");
    await ensureTasklessDirectory(cwd);
    const { getEmbeddedSkills } = await import("../src/install/install");
    const skills = getEmbeddedSkills();
    await applyInstallPlan(
      cwd,
      {
        targets: [
          {
            tool: {
              name: "Claude Code",
              detect: [{ type: "directory", path: ".claude" }],
              installDir: ".claude",
              skills: { path: "skills" },
              commands: { path: "commands/tskl" },
            },
            skills: skills.filter((s) => s.name === "taskless-ci"),
            commands: [],
          },
        ],
      },
      { cliVersion: "0.5.4" }
    );

    // Now run wizard dropping taskless-ci → removal → summary confirms=false
    clackResponses.optionalSkills = [];
    const result = await runWizard({ cwd });
    expect(result.status).toBe("cancelled");
    expect(result.cancelledStep).toBe("summary");

    // taskless-ci should still be present (no write happened)
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-ci", "SKILL.md"))
    ).toBe(true);
  });
});
