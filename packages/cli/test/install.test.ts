import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  detectTools,
  getEmbeddedSkills,
  installForTool,
  checkStaleness,
} from "../src/install/install";

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "taskless-install-test-"));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("detectTools", () => {
  it("detects Claude Code via .claude/ directory", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("Claude Code");
  });

  it("returns empty when no signals match", async () => {
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(0);
  });
});

describe("installForTool", () => {
  it("writes skills to installDir-based path", async () => {
    const skills = getEmbeddedSkills();
    const tool = {
      name: "Test Tool",
      detect: [{ type: "directory" as const, path: ".test" }],
      installDir: ".test",
      skills: { path: "skills" },
    };

    const result = await installForTool(cwd, tool, skills, []);
    expect(result.skills.length).toBeGreaterThan(0);

    const firstSkill = result.skills[0]!;
    const content = await readFile(
      join(cwd, ".test", "skills", firstSkill, "SKILL.md"),
      "utf8"
    );
    expect(content).toBeTruthy();
  });

  it("creates directories if installDir does not exist", async () => {
    const tool = {
      name: "Test Tool",
      detect: [{ type: "file" as const, path: "TEST.md" }],
      installDir: ".nonexistent",
      skills: { path: "skills" },
    };
    const skills = getEmbeddedSkills();

    const result = await installForTool(cwd, tool, skills, []);
    expect(result.skills.length).toBeGreaterThan(0);

    const firstSkill = result.skills[0]!;
    const content = await readFile(
      join(cwd, ".nonexistent", "skills", firstSkill, "SKILL.md"),
      "utf8"
    );
    expect(content).toBeTruthy();
  });
});

describe("checkStaleness", () => {
  it("reports status using installDir-based paths", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });

    const skills = getEmbeddedSkills();
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);

    await installForTool(cwd, tools[0]!, skills, []);

    const statuses = await checkStaleness(cwd);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.name).toBe("Claude Code");
    expect(statuses[0]!.skills.length).toBeGreaterThan(0);

    for (const skill of statuses[0]!.skills) {
      expect(skill.current).toBe(true);
    }
  });
});
