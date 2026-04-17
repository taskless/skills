import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  computeInstallDiff,
  readInstallState,
  writeInstallState,
  type InstallState,
} from "../src/install/state";

const emptyState: InstallState = { targets: {} };

describe("computeInstallDiff", () => {
  it("adds a brand-new target", () => {
    const diff = computeInstallDiff(emptyState, {
      targets: {
        ".claude": { skills: ["taskless-check"], commands: ["check"] },
      },
    });
    expect(diff.hasAdditions).toBe(true);
    expect(diff.hasRemovals).toBe(false);
    expect(diff.entries).toHaveLength(1);
    expect(diff.entries[0]?.target).toBe(".claude");
    expect(diff.entries[0]?.additions.skills).toEqual(["taskless-check"]);
    expect(diff.entries[0]?.additions.commands).toEqual(["check"]);
    expect(diff.entries[0]?.removals.skills).toEqual([]);
  });

  it("removes a previous target entirely", () => {
    const diff = computeInstallDiff(
      {
        targets: {
          ".cursor": { skills: ["taskless-check"], commands: [] },
        },
      },
      emptyState
    );
    expect(diff.hasRemovals).toBe(true);
    expect(diff.hasAdditions).toBe(false);
    expect(diff.entries[0]?.removals.skills).toEqual(["taskless-check"]);
  });

  it("adds a skill within an existing target", () => {
    const diff = computeInstallDiff(
      {
        targets: {
          ".claude": { skills: ["taskless-check"], commands: [] },
        },
      },
      {
        targets: {
          ".claude": {
            skills: ["taskless-check", "taskless-ci"],
            commands: [],
          },
        },
      }
    );
    expect(diff.hasAdditions).toBe(true);
    expect(diff.hasRemovals).toBe(false);
    expect(diff.entries[0]?.additions.skills).toEqual(["taskless-ci"]);
    expect(diff.entries[0]?.unchanged.skills).toEqual(["taskless-check"]);
  });

  it("removes a skill within an existing target", () => {
    const diff = computeInstallDiff(
      {
        targets: {
          ".claude": {
            skills: ["taskless-check", "taskless-ci"],
            commands: [],
          },
        },
      },
      {
        targets: {
          ".claude": { skills: ["taskless-check"], commands: [] },
        },
      }
    );
    expect(diff.hasRemovals).toBe(true);
    expect(diff.entries[0]?.removals.skills).toEqual(["taskless-ci"]);
    expect(diff.entries[0]?.unchanged.skills).toEqual(["taskless-check"]);
  });

  it("zero-diff re-run produces no additions or removals", () => {
    const state: InstallState = {
      targets: {
        ".claude": {
          skills: ["taskless-check", "taskless-ci"],
          commands: ["check"],
        },
      },
    };
    const diff = computeInstallDiff(state, state);
    expect(diff.hasAdditions).toBe(false);
    expect(diff.hasRemovals).toBe(false);
    expect(diff.entries[0]?.unchanged.skills).toEqual([
      "taskless-check",
      "taskless-ci",
    ]);
  });
});

describe("readInstallState / writeInstallState", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "taskless-install-state-")
    );
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });
    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({ version: 2, install: {} }),
      "utf8"
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("returns empty state when install is empty", async () => {
    const state = await readInstallState(temporaryDirectory);
    expect(state.targets).toEqual({});
  });

  it("round-trips through write then read", async () => {
    const state: InstallState = {
      installedAt: "2026-04-16T12:00:00.000Z",
      cliVersion: "0.5.4",
      targets: {
        ".claude": {
          skills: ["taskless-check", "taskless-ci"],
          commands: ["check"],
        },
      },
    };
    await writeInstallState(temporaryDirectory, state);

    const roundtrip = await readInstallState(temporaryDirectory);
    expect(roundtrip).toEqual(state);
  });

  it("preserves other top-level manifest fields", async () => {
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({ version: 2, install: {}, unknown: { keep: "me" } }),
      "utf8"
    );

    await writeInstallState(temporaryDirectory, {
      targets: { ".claude": { skills: ["taskless-check"], commands: [] } },
    });

    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as Record<string, unknown>;

    expect(manifest.version).toBe(2);
    expect(manifest.unknown).toEqual({ keep: "me" });
    expect(manifest.install).toEqual({
      targets: { ".claude": { skills: ["taskless-check"] } },
    });
  });
});
