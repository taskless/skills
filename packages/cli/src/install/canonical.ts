import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { stringify } from "yaml";

import { parseFrontmatter } from "./frontmatter";

/**
 * The Taskless-owned namespace that holds canonical skill and command
 * content. No tool target ever installs into or cleans up this directory,
 * which is what makes the canonical content safe from destructive cleanup.
 */
const CANONICAL_DIR = ".taskless";

/** Frontmatter fields copied verbatim from canonical content into a stub. */
export interface StubFrontmatter {
  name: string;
  description: string;
  /**
   * Version of the canonical content this stub was generated from. Carried
   * for reference and kept in lockstep — a version change counts as drift, so
   * `update` regenerates the stub.
   */
  version?: string;
}

/**
 * Command-stub frontmatter. Beyond `name`/`description`, the canonical
 * command's `argument-hint` is preserved so the slash command keeps its
 * editor argument hint.
 */
export interface CommandStubFrontmatter extends StubFrontmatter {
  argumentHint?: string;
}

/** Workspace-relative path of the canonical skill file for `name`. */
export function canonicalSkillPath(name: string): string {
  return `${CANONICAL_DIR}/skills/${name}/SKILL.md`;
}

/** Workspace-relative path of the canonical command file for `filename`. */
export function canonicalCommandPath(filename: string): string {
  return `${CANONICAL_DIR}/commands/tskl/${filename}`;
}

/**
 * Write a skill's full content to the canonical store at
 * `.taskless/skills/<name>/SKILL.md`. Content is written verbatim — the
 * canonical store is the single source of truth.
 */
export async function writeCanonicalSkill(
  cwd: string,
  name: string,
  content: string
): Promise<string> {
  const directory = join(cwd, CANONICAL_DIR, "skills", name);
  await mkdir(directory, { recursive: true });
  const path = join(directory, "SKILL.md");
  await writeFile(path, content, "utf8");
  return path;
}

/**
 * Write a command's full content to the canonical store at
 * `.taskless/commands/tskl/<filename>`. Content is written verbatim.
 */
export async function writeCanonicalCommand(
  cwd: string,
  filename: string,
  content: string
): Promise<string> {
  const directory = join(cwd, CANONICAL_DIR, "commands", "tskl");
  await mkdir(directory, { recursive: true });
  const path = join(directory, filename);
  await writeFile(path, content, "utf8");
  return path;
}

/**
 * Frontmatter `metadata` block stamped onto a stub. `type: shim` marks the
 * file as a reference stub so it is distinguishable from a full copy without
 * inspecting the body (see {@link isShimStub}); `version` records the
 * canonical version the stub was generated from.
 */
function shimMetadata(version: string | undefined): Record<string, string> {
  return version ? { type: "shim", version } : { type: "shim" };
}

/** Serialize ordered frontmatter fields into a `---`-delimited block. */
function frontmatterBlock(fields: Record<string, unknown>): string {
  const yaml = stringify(fields).trimEnd();
  return `---\n${yaml}\n---\n`;
}

/**
 * Build a reference skill stub: a real `SKILL.md` whose frontmatter carries
 * `name`/`description` (so the tool discovers and triggers it) and whose body
 * delegates to the canonical file without inlining its instructions.
 */
export function buildSkillStub(meta: StubFrontmatter): string {
  const canonical = canonicalSkillPath(meta.name);
  return (
    frontmatterBlock({
      name: meta.name,
      description: meta.description,
      metadata: shimMetadata(meta.version),
    }) +
    "\n" +
    `This is a Taskless reference stub. The canonical skill is defined at ` +
    `\`${canonical}\`.\n\n` +
    `Read \`${canonical}\` and follow its instructions.\n`
  );
}

/**
 * Build a reference command stub: a real command file whose frontmatter
 * carries `name`/`description` and whose body passes `$ARGUMENTS` through and
 * delegates to the canonical command file.
 */
export function buildCommandStub(
  meta: CommandStubFrontmatter,
  filename: string
): string {
  const canonical = canonicalCommandPath(filename);
  const fields: Record<string, unknown> = {
    name: meta.name,
    description: meta.description,
  };
  if (meta.argumentHint) fields["argument-hint"] = meta.argumentHint;
  fields.metadata = shimMetadata(meta.version);
  return (
    frontmatterBlock(fields) +
    "\n" +
    `This command was invoked with: $ARGUMENTS\n\n` +
    `This is a Taskless reference stub. The canonical command is defined at ` +
    `\`${canonical}\`.\n\n` +
    `Read \`${canonical}\` and follow its instructions, treating the text ` +
    `above as the command arguments.\n`
  );
}

/**
 * Report whether an existing stub's frontmatter has drifted from the
 * canonical `name`/`description`. Used by `update` to decide whether a stub
 * needs regeneration — a stub that still matches is left untouched.
 */
export function stubFrontmatterDrifted(
  existingStub: string,
  meta: StubFrontmatter
): boolean {
  const { data } = parseFrontmatter(existingStub);
  if (data.name !== meta.name || data.description !== meta.description) {
    return true;
  }
  const metadata = data.metadata as { version?: unknown } | undefined;
  const stubVersion =
    typeof metadata?.version === "string" ? metadata.version : undefined;
  return stubVersion !== meta.version;
}

/**
 * Whether `content` is a Taskless reference stub, identified by its
 * frontmatter `metadata.type === "shim"`. A full canonical copy lacks this
 * marker, so install can tell a stub apart from a copy it must convert.
 */
export function isShimStub(content: string): boolean {
  const { data } = parseFrontmatter(content);
  const metadata = data.metadata;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    (metadata as Record<string, unknown>).type === "shim"
  );
}
