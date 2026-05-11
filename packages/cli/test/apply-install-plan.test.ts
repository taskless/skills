import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyInstallPlan,
  getEmbeddedSkills,
  type ToolDescriptor,
} from "../src/install/install";
import { readInstallState } from "../src/install/state";

const TEST_TOOL: ToolDescriptor = {
  name: "Test Tool",
  detect: [{ type: "directory", path: ".test" }],
  installDir: ".claude",
  skills: { path: "skills" },
  commands: { path: "commands/tskl" },
};

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function seedTasklessDirectory(cwd: string): Promise<void> {
  const tasklessDirectory = join(cwd, ".taskless");
  await mkdir(tasklessDirectory, { recursive: true });
  await writeFile(
    join(tasklessDirectory, "taskless.json"),
    JSON.stringify({ version: 2, install: {} }),
    "utf8"
  );
}

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "taskless-apply-"));
  await seedTasklessDirectory(cwd);
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("applyInstallPlan", () => {
  it("writes selected skills to the target and records state", async () => {
    const skills = getEmbeddedSkills();
    const taskless = skills.find((s) => s.name === "taskless")!;

    const result = await applyInstallPlan(
      cwd,
      {
        targets: [{ tool: TEST_TOOL, skills: [taskless], commands: [] }],
      },
      { cliVersion: "0.5.4" }
    );

    expect(result.writtenSkills).toHaveLength(1);
    expect(result.removedSkills).toHaveLength(0);

    const skillContent = await readFile(
      join(cwd, ".claude", "skills", "taskless", "SKILL.md"),
      "utf8"
    );
    expect(skillContent).toContain("taskless");

    const state = await readInstallState(cwd);
    expect(state.cliVersion).toBe("0.5.4");
    expect(state.targets[".claude"]?.skills).toEqual(["taskless"]);
  });

  it("surgically removes obsolete skills recorded in the previous state", async () => {
    const skills = getEmbeddedSkills();
    const taskless = skills.find((s) => s.name === "taskless")!;

    // Seed manifest with a stale skill name (e.g. left over from a prior
    // CLI version) AND a real one. We don't need the file on disk — the
    // diff drives removals from the manifest, not the filesystem.
    const { writeInstallState } = await import("../src/install/state");
    await writeInstallState(cwd, {
      installedAt: "2026-04-01T00:00:00.000Z",
      cliVersion: "0.5.4",
      targets: {
        ".claude": {
          skills: ["taskless", "taskless-removed-fixture"],
          commands: [],
        },
      },
    });

    const second = await applyInstallPlan(
      cwd,
      {
        targets: [{ tool: TEST_TOOL, skills: [taskless], commands: [] }],
      },
      { cliVersion: "0.5.4" }
    );

    expect(second.removedSkills).toEqual([
      { target: ".claude", skill: "taskless-removed-fixture" },
    ]);
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless", "SKILL.md"))
    ).toBe(true);
  });

  it("does not touch unknown files in the skills directory", async () => {
    const skills = getEmbeddedSkills();
    const taskless = skills.find((s) => s.name === "taskless")!;

    // User-owned file that the CLI must never delete
    const userOwned = join(cwd, ".claude", "skills", "user-tool", "SKILL.md");
    await mkdir(join(cwd, ".claude", "skills", "user-tool"), {
      recursive: true,
    });
    await writeFile(userOwned, "# user skill", "utf8");

    await applyInstallPlan(
      cwd,
      {
        targets: [{ tool: TEST_TOOL, skills: [taskless], commands: [] }],
      },
      { cliVersion: "0.5.4" }
    );

    expect(await exists(userOwned)).toBe(true);
  });

  it("zero-diff re-run produces no removals", async () => {
    const skills = getEmbeddedSkills();
    const taskless = skills.find((s) => s.name === "taskless")!;

    const plan = {
      targets: [{ tool: TEST_TOOL, skills: [taskless], commands: [] }],
    };
    await applyInstallPlan(cwd, plan, { cliVersion: "0.5.4" });
    const second = await applyInstallPlan(cwd, plan, { cliVersion: "0.5.4" });

    expect(second.removedSkills).toHaveLength(0);
    expect(second.writtenSkills).toHaveLength(1);
  });

  it("v0.6 → v0.7 migration removes 10 old skills + 6 old commands and writes the consolidated skill", async () => {
    const skills = getEmbeddedSkills();
    const taskless = skills.find((s) => s.name === "taskless")!;

    // Seed manifest exactly as v0.6 would have left it.
    const v6Skills = [
      "taskless-check",
      "taskless-ci",
      "taskless-create-rule",
      "taskless-create-rule-anonymous",
      "taskless-delete-rule",
      "taskless-improve-rule",
      "taskless-improve-rule-anonymous",
      "taskless-info",
      "taskless-login",
      "taskless-logout",
    ];
    const v6Commands = [
      "check.md",
      "improve.md",
      "info.md",
      "login.md",
      "logout.md",
      "rule.md",
    ];

    // Create the actual files on disk so we can assert they're deleted.
    const claudeSkills = join(cwd, ".claude", "skills");
    for (const name of v6Skills) {
      await mkdir(join(claudeSkills, name), { recursive: true });
      await writeFile(
        join(claudeSkills, name, "SKILL.md"),
        "# stale v0.6 skill",
        "utf8"
      );
    }
    const claudeCommands = join(cwd, ".claude", "commands", "tskl");
    await mkdir(claudeCommands, { recursive: true });
    for (const name of v6Commands) {
      await writeFile(join(claudeCommands, name), "stale v0.6 command", "utf8");
    }

    // Record those installs in the manifest so the diff sees them as
    // existing.
    const { writeInstallState } = await import("../src/install/state");
    await writeInstallState(cwd, {
      installedAt: "2026-04-17T00:00:00.000Z",
      cliVersion: "0.6.0",
      targets: {
        ".claude": { skills: v6Skills, commands: v6Commands },
      },
    });

    // Now run the v0.7 install plan: one skill (taskless), one command
    // (tskl.md). The install should delete the 10 + 6 obsolete files and
    // write the new ones.
    const result = await applyInstallPlan(
      cwd,
      {
        targets: [
          {
            tool: TEST_TOOL,
            skills: [taskless],
            commands: [{ filename: "tskl.md", content: "# new command" }],
          },
        ],
      },
      { cliVersion: "0.7.0" }
    );

    expect(result.removedSkills).toHaveLength(10);
    expect(result.removedCommands).toHaveLength(6);
    expect(result.writtenSkills).toHaveLength(1);
    expect(result.writtenCommands).toHaveLength(1);

    // Old files gone
    for (const name of v6Skills) {
      expect(await exists(join(claudeSkills, name))).toBe(false);
    }
    for (const name of v6Commands) {
      expect(await exists(join(claudeCommands, name))).toBe(false);
    }

    // New files present
    expect(await exists(join(claudeSkills, "taskless", "SKILL.md"))).toBe(true);
    expect(await exists(join(claudeCommands, "tskl.md"))).toBe(true);

    // Manifest reflects the new layout
    const state = await readInstallState(cwd);
    expect(state.cliVersion).toBe("0.7.0");
    expect(state.targets[".claude"]?.skills).toEqual(["taskless"]);
    expect(state.targets[".claude"]?.commands).toEqual(["tskl.md"]);
  });
});
