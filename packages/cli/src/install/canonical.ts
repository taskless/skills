import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { stringify } from "yaml";

import { applyCliInvocation, withCliBuildNotice } from "../util/invocation";
import { parseFrontmatter } from "./frontmatter";

/**
 * The Taskless-owned namespace that holds canonical skill and command
 * content. No tool target ever installs into or cleans up this directory,
 * which is what makes the canonical content safe from destructive cleanup.
 */
const CANONICAL_DIR = ".taskless";

/**
 * Frontmatter fields copied verbatim from canonical content into a stub.
 * Intentionally version-free: a stub is part of the footprint outside
 * `.taskless`, so it must stay byte-stable across releases that do not change
 * its `name`/`description`. The canonical version lives only in `.taskless`.
 */
export interface StubFrontmatter {
  name: string;
  description: string;
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
  await writeFile(
    path,
    withCliBuildNotice(applyCliInvocation(content)),
    "utf8"
  );
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
  await writeFile(
    path,
    withCliBuildNotice(applyCliInvocation(content)),
    "utf8"
  );
  return path;
}

/**
 * Frontmatter `metadata` block stamped onto a stub. `type: shim` marks the
 * file as a reference stub so it is distinguishable from a full copy without
 * inspecting the body (see {@link isShimStub}). No version is recorded — the
 * stub footprint outside `.taskless` is kept stable across releases.
 */
function shimMetadata(): Record<string, string> {
  return { type: "shim" };
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
      metadata: shimMetadata(),
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
  fields.metadata = shimMetadata();
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
 * Report whether an existing stub's frontmatter has drifted from what would
 * be generated now. Used by `update` to decide whether a stub needs
 * regeneration — a stub that still matches is left untouched.
 *
 * Drift triggers on a `name`/`description` change, and — as a one-time
 * migration — on the presence of a `metadata.version` field. Current stubs
 * carry no version; an older stub that still has one is rewritten once to
 * strip it, after which it stays byte-stable across releases.
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
  return metadata?.version !== undefined;
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
