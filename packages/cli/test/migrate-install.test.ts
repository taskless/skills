import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { ensureTasklessDirectory } from "../src/filesystem/directory";
import { readManifest, writeManifest } from "../src/filesystem/migrate";

describe("migration 2 — install state", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "taskless-migrate-install-")
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("fresh project reaches { version: 2, install: {} }", async () => {
    await ensureTasklessDirectory(temporaryDirectory);

    const manifest = JSON.parse(
      await readFile(
        join(temporaryDirectory, ".taskless", "taskless.json"),
        "utf8"
      )
    ) as { version: number; install: Record<string, unknown> };

    expect(manifest.version).toBe(2);
    expect(manifest.install).toEqual({});
  });

  it("forward-migrates a v1 project", async () => {
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });
    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({ version: 1 }),
      "utf8"
    );

    await ensureTasklessDirectory(temporaryDirectory);

    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as { version: number; install: Record<string, unknown> };

    expect(manifest.version).toBe(2);
    expect(manifest.install).toEqual({});
  });

  it("preserves an existing install object on re-run", async () => {
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });

    const existingInstall = {
      installedAt: "2026-04-16T00:00:00.000Z",
      cliVersion: "0.5.4",
      targets: {
        ".claude": { skills: ["taskless-check"] },
      },
    };
    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({ version: 2, install: existingInstall }),
      "utf8"
    );

    await ensureTasklessDirectory(temporaryDirectory);

    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as { version: number; install: typeof existingInstall };

    expect(manifest.version).toBe(2);
    expect(manifest.install).toEqual(existingInstall);
  });

  it("preserves unknown top-level fields through migrate + write cycle", async () => {
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });

    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({
        version: 1,
        experimental: { flag: true, note: "do not delete" },
      }),
      "utf8"
    );

    await ensureTasklessDirectory(temporaryDirectory);

    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as Record<string, unknown>;

    expect(manifest.version).toBe(2);
    expect(manifest.install).toEqual({});
    expect(manifest.experimental).toEqual({
      flag: true,
      note: "do not delete",
    });
  });

  it("readManifest / writeManifest preserves unknown fields on explicit round-trip", async () => {
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });

    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({
        version: 2,
        install: { targets: { ".claude": { skills: ["taskless-check"] } } },
        unknown: { keep: "me" },
      }),
      "utf8"
    );

    const { manifest, raw } = await readManifest(tasklessDirectory);
    expect(manifest.version).toBe(2);
    expect(raw.unknown).toEqual({ keep: "me" });

    await writeManifest(tasklessDirectory, manifest, raw);

    const rewritten = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as Record<string, unknown>;

    expect(rewritten.unknown).toEqual({ keep: "me" });
    expect(rewritten.install).toEqual({
      targets: { ".claude": { skills: ["taskless-check"] } },
    });
  });
});
