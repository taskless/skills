import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyInstallPlan,
  buildInstallPlan,
  getEmbeddedCommands,
  getEmbeddedSkills,
} from "../src/install/install";
import { isShimStub } from "../src/install/canonical";
import { parseFrontmatter } from "../src/install/frontmatter";
import { readInstallState, writeInstallState } from "../src/install/state";

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

function tasklessSkill() {
  const skill = getEmbeddedSkills().find((s) => s.name === "taskless");
  if (!skill) throw new Error("embedded taskless skill missing");
  return skill;
}

describe("applyInstallPlan", () => {
  it("writes canonical full content and a reference stub, recording modes", async () => {
    const skills = [tasklessSkill()];
    const commands = getEmbeddedCommands();
    const plan = buildInstallPlan([".claude"], skills, commands);

    const result = await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    // Canonical store holds verbatim content.
    const canonical = await readFile(
      join(cwd, ".taskless", "skills", "taskless", "SKILL.md"),
      "utf8"
    );
    expect(canonical).toBe(tasklessSkill().content);

    // The .claude target holds a delegating stub, not the full content.
    const stub = await readFile(
      join(cwd, ".claude", "skills", "taskless", "SKILL.md"),
      "utf8"
    );
    expect(stub).not.toBe(canonical);
    expect(parseFrontmatter(stub).content).toContain(
      ".taskless/skills/taskless/SKILL.md"
    );

    // Manifest records modes.
    const state = await readInstallState(cwd);
    expect(state.targets[".taskless"]?.mode).toBe("canonical");
    expect(state.targets[".claude"]?.mode).toBe("reference");
    expect(result.writtenSkills.length).toBeGreaterThan(0);
  });

  it("writes a command stub only for command-capable targets", async () => {
    const plan = buildInstallPlan(
      [".claude", ".opencode"],
      [tasklessSkill()],
      getEmbeddedCommands()
    );
    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    expect(
      await exists(join(cwd, ".claude", "commands", "tskl", "tskl.md"))
    ).toBe(true);
    expect(await exists(join(cwd, ".opencode", "commands"))).toBe(false);
    // .opencode still gets its skill stub.
    expect(
      await exists(join(cwd, ".opencode", "skills", "taskless", "SKILL.md"))
    ).toBe(true);
  });

  it("rewrites the canonical store but skips an unchanged reference stub", async () => {
    const plan = buildInstallPlan(
      [".claude"],
      [tasklessSkill()],
      getEmbeddedCommands()
    );
    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });
    const second = await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    // Canonical is always rewritten; the unchanged .claude stub is skipped.
    expect(second.writtenSkills).toContainEqual({
      target: ".taskless",
      skill: "taskless",
    });
    expect(second.writtenSkills).not.toContainEqual({
      target: ".claude",
      skill: "taskless",
    });
    expect(second.removedSkills).toHaveLength(0);
  });

  it("does not clobber an existing reference stub on re-run", async () => {
    const plan = buildInstallPlan([".claude"], [tasklessSkill()], []);
    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    const stubPath = join(cwd, ".claude", "skills", "taskless", "SKILL.md");
    const before = await readFile(stubPath, "utf8");

    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });
    const after = await readFile(stubPath, "utf8");

    expect(after).toBe(before);
    expect(parseFrontmatter(after).content).toContain(
      ".taskless/skills/taskless/SKILL.md"
    );
  });

  it("never deletes the canonical store while cleaning another target", async () => {
    // Prior install recorded an obsolete skill under .claude.
    await writeInstallState(cwd, {
      installedAt: "2026-04-01T00:00:00.000Z",
      cliVersion: "0.6.0",
      targets: {
        ".claude": {
          skills: ["taskless", "taskless-obsolete"],
          commands: [],
          mode: "reference",
        },
      },
    });

    const plan = buildInstallPlan([".claude"], [tasklessSkill()], []);
    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    // The obsolete .claude skill is gone; the canonical store is intact.
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-obsolete"))
    ).toBe(false);
    expect(
      await exists(join(cwd, ".taskless", "skills", "taskless", "SKILL.md"))
    ).toBe(true);
  });

  it("surgically removes obsolete skills and commands recorded for a target", async () => {
    const v6Skills = [
      "taskless-check",
      "taskless-ci",
      "taskless-create-rule",
      "taskless-delete-rule",
      "taskless-improve-rule",
      "taskless-info",
      "taskless-login",
      "taskless-logout",
    ];
    const v6Commands = ["check.md", "improve.md", "info.md"];

    const claudeSkills = join(cwd, ".claude", "skills");
    for (const name of v6Skills) {
      await mkdir(join(claudeSkills, name), { recursive: true });
      await writeFile(
        join(claudeSkills, name, "SKILL.md"),
        "# stale skill",
        "utf8"
      );
    }
    const claudeCommands = join(cwd, ".claude", "commands", "tskl");
    await mkdir(claudeCommands, { recursive: true });
    for (const name of v6Commands) {
      await writeFile(join(claudeCommands, name), "stale command", "utf8");
    }

    await writeInstallState(cwd, {
      installedAt: "2026-04-17T00:00:00.000Z",
      cliVersion: "0.6.0",
      targets: {
        ".claude": { skills: v6Skills, commands: v6Commands },
      },
    });

    const plan = buildInstallPlan(
      [".claude"],
      [tasklessSkill()],
      getEmbeddedCommands()
    );
    const result = await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    expect(result.removedSkills).toHaveLength(v6Skills.length);
    expect(result.removedCommands).toHaveLength(v6Commands.length);
    for (const name of v6Skills) {
      expect(await exists(join(claudeSkills, name))).toBe(false);
    }
    for (const name of v6Commands) {
      expect(await exists(join(claudeCommands, name))).toBe(false);
    }
  });

  it("converts a full per-tool copy into a shim stub", async () => {
    const skill = tasklessSkill();
    const claudeSkill = join(cwd, ".claude", "skills", "taskless", "SKILL.md");
    // An older install left a full copy here — no shim marker.
    await mkdir(dirname(claudeSkill), { recursive: true });
    await writeFile(claudeSkill, skill.content, "utf8");
    expect(isShimStub(await readFile(claudeSkill, "utf8"))).toBe(false);

    await applyInstallPlan(cwd, buildInstallPlan([".claude"], [skill], []), {
      cliVersion: "0.7.0",
    });

    const after = await readFile(claudeSkill, "utf8");
    expect(isShimStub(after)).toBe(true);
    expect(parseFrontmatter(after).content).toContain(
      ".taskless/skills/taskless/SKILL.md"
    );
  });

  it("replaces a symlinked tool entry with a real shim stub", async () => {
    const skill = tasklessSkill();
    const claudeSkill = join(cwd, ".claude", "skills", "taskless", "SKILL.md");
    const linkTarget = join(cwd, "external-skill.md");
    await writeFile(linkTarget, skill.content, "utf8");
    await mkdir(dirname(claudeSkill), { recursive: true });
    await symlink(linkTarget, claudeSkill);

    await applyInstallPlan(cwd, buildInstallPlan([".claude"], [skill], []), {
      cliVersion: "0.7.0",
    });

    const stats = await lstat(claudeSkill);
    expect(stats.isSymbolicLink()).toBe(false);
    expect(stats.isFile()).toBe(true);
    expect(isShimStub(await readFile(claudeSkill, "utf8"))).toBe(true);
    // The symlink target file itself is left untouched.
    expect(await readFile(linkTarget, "utf8")).toBe(skill.content);
  });

  it("does not touch unknown files in a skills directory", async () => {
    const userOwned = join(cwd, ".claude", "skills", "user-tool", "SKILL.md");
    await mkdir(join(cwd, ".claude", "skills", "user-tool"), {
      recursive: true,
    });
    await writeFile(userOwned, "# user skill", "utf8");

    const plan = buildInstallPlan([".claude"], [tasklessSkill()], []);
    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    expect(await exists(userOwned)).toBe(true);
  });
});
