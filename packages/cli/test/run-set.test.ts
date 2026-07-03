import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readdir,
  readFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalHash } from "../src/rules/rule-hash";
import {
  materializeRunDirectory,
  selectRunFiles,
  signRuleFiles,
  type SignedRuleFile,
} from "../src/rules/run-set";

async function writeRule(
  cwd: string,
  name: string,
  body: string
): Promise<void> {
  const rulesDirectory = join(cwd, ".taskless", "rules");
  await mkdir(rulesDirectory, { recursive: true });
  await writeFile(join(rulesDirectory, name), body, "utf8");
}

describe("signRuleFiles", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "taskless-runset-"));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("signs each rule file with its canonical signature", async () => {
    await writeRule(directory, "a.yml", "id: a\n");
    await writeRule(directory, "b.yml", "id: b\n");

    const signed = await signRuleFiles(directory, ["a.yml", "b.yml"]);

    expect(signed.map((s) => s.file).toSorted()).toEqual(["a.yml", "b.yml"]);
    for (const entry of signed) {
      const expected = await canonicalHash(await readFile(entry.path, "utf8"));
      expect(entry.signature).toBe(expected);
    }
  });
});

describe("selectRunFiles", () => {
  const signed: SignedRuleFile[] = [
    { file: "a.yml", path: "/x/a.yml", signature: "1;h=sha-256;d=aaaa" },
    { file: "b.yml", path: "/x/b.yml", signature: "1;h=sha-256;d=bbbb" },
  ];

  it("selects only files whose signature the server blessed", () => {
    const runFiles = selectRunFiles(signed, [
      { ruleId: "a", file: "a.yml", signature: "1;h=sha-256;d=aaaa" },
    ]);
    expect(runFiles.map((s) => s.file)).toEqual(["a.yml"]);
  });

  it("matches by signature, not path (a moved-but-unchanged file resolves)", () => {
    const runFiles = selectRunFiles(signed, [
      { ruleId: "b", file: "moved/b.yml", signature: "1;h=sha-256;d=bbbb" },
    ]);
    expect(runFiles.map((s) => s.file)).toEqual(["b.yml"]);
  });

  it("drops run entries with no local signature match", () => {
    const runFiles = selectRunFiles(signed, [
      { ruleId: "c", file: "c.yml", signature: "1;h=sha-256;d=cccc" },
    ]);
    expect(runFiles).toEqual([]);
  });

  it("does not select the same local file twice", () => {
    const runFiles = selectRunFiles(signed, [
      { ruleId: "a", file: "a.yml", signature: "1;h=sha-256;d=aaaa" },
      { ruleId: "a", file: "a-copy.yml", signature: "1;h=sha-256;d=aaaa" },
    ]);
    expect(runFiles.map((s) => s.file)).toEqual(["a.yml"]);
  });
});

describe("materializeRunDirectory", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "taskless-runset-"));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("copies only the selected files and gitignores .run/", async () => {
    await writeRule(directory, "a.yml", "id: a\n");
    await writeRule(directory, "b.yml", "id: b\n");
    const signed = await signRuleFiles(directory, ["a.yml", "b.yml"]);
    const onlyA = signed.filter((s) => s.file === "a.yml");

    await materializeRunDirectory(directory, onlyA);

    const runRules = join(directory, ".taskless", ".run", "rules");
    expect(await readdir(runRules)).toEqual(["a.yml"]);

    const gitignore = await readFile(
      join(directory, ".taskless", ".gitignore"),
      "utf8"
    );
    expect(gitignore).toContain(".run/");
  });

  it("rebuilds the run dir, dropping stale files from a prior run", async () => {
    await writeRule(directory, "a.yml", "id: a\n");
    await writeRule(directory, "b.yml", "id: b\n");
    const signed = await signRuleFiles(directory, ["a.yml", "b.yml"]);

    await materializeRunDirectory(directory, signed); // both
    await materializeRunDirectory(
      directory,
      signed.filter((s) => s.file === "b.yml")
    ); // only b

    const runRules = join(directory, ".taskless", ".run", "rules");
    expect(await readdir(runRules)).toEqual(["b.yml"]);
  });
});
