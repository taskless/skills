import {
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { join, basename, dirname } from "node:path";

import { parseFrontmatter } from "./frontmatter";
import {
  computeInstallDiff,
  readInstallState,
  writeInstallState,
  type InstallState,
} from "./state";

// Skill files embedded at build time via Vite import.meta.glob
const skillFiles: Record<string, string> = import.meta.glob(
  "../../../../skills/**/SKILL.md",
  { query: "?raw", import: "default", eager: true }
);

// Command files embedded at build time via Vite import.meta.glob
const commandFiles: Record<string, string> = import.meta.glob(
  "../../../../commands/tskl/**/*.md",
  { query: "?raw", import: "default", eager: true }
);

// --- Types ---

export interface DetectionSignal {
  type: "directory" | "file";
  path: string;
}

export interface ToolDescriptor {
  name: string;
  detect: DetectionSignal[];
  installDir: string;
  skills: {
    path: string;
  };
  commands?: {
    path: string;
  };
}

export interface EmbeddedSkill {
  name: string;
  description: string;
  content: string;
  body: string;
  metadata: Record<string, string>;
}

export interface EmbeddedCommand {
  filename: string;
  content: string;
}

export interface SkillStatus {
  name: string;
  installedVersion: string | undefined;
  currentVersion: string;
  current: boolean;
}

export interface ToolStatus {
  name: string;
  skills: SkillStatus[];
}

// --- Tool Registry ---

const TOOLS: ToolDescriptor[] = [
  {
    name: "Claude Code",
    detect: [
      { type: "directory", path: ".claude" },
      { type: "file", path: "CLAUDE.md" },
    ],
    installDir: ".claude",
    skills: {
      path: "skills",
    },
    commands: {
      path: "commands/tskl",
    },
  },
  {
    name: "OpenCode",
    detect: [
      { type: "directory", path: ".opencode" },
      { type: "file", path: "opencode.jsonc" },
      { type: "file", path: "opencode.json" },
    ],
    installDir: ".opencode",
    skills: {
      path: "skills",
    },
  },
  {
    name: "Cursor",
    detect: [
      { type: "directory", path: ".cursor" },
      { type: "file", path: ".cursorrules" },
    ],
    installDir: ".cursor",
    skills: {
      path: "skills",
    },
  },
];

export const AGENTS_FALLBACK: ToolDescriptor = {
  name: "Agent Skills",
  detect: [],
  installDir: ".agents",
  skills: {
    path: "skills",
  },
};

// --- Detection ---

async function checkSignal(
  cwd: string,
  signal: DetectionSignal
): Promise<boolean> {
  const fullPath = join(cwd, signal.path);
  if (signal.type === "directory") {
    return stat(fullPath)
      .then((s) => s.isDirectory())
      .catch(() => false);
  }
  return stat(fullPath)
    .then((s) => s.isFile())
    .catch(() => false);
}

export async function detectTools(cwd: string): Promise<ToolDescriptor[]> {
  const results = await Promise.all(
    TOOLS.map(async (tool) => {
      const signals = await Promise.all(
        tool.detect.map((signal) => checkSignal(cwd, signal))
      );
      return signals.some(Boolean) ? tool : undefined;
    })
  );
  return results.filter((t): t is ToolDescriptor => t !== undefined);
}

// --- Embedded Skills ---

export function getEmbeddedSkills(): EmbeddedSkill[] {
  return Object.entries(skillFiles).map(([path, content]) => {
    const parsed = parseFrontmatter(content);
    const data = parsed.data as {
      name?: string;
      description?: string;
      metadata?: Record<string, string>;
    };
    return {
      name: data.name ?? basename(dirname(path)),
      description: data.description ?? "",
      content,
      body: parsed.content,
      metadata: (data.metadata as Record<string, string>) ?? {},
    };
  });
}

// --- Embedded Commands ---

export function getEmbeddedCommands(): EmbeddedCommand[] {
  return Object.entries(commandFiles).map(([path, content]) => ({
    filename: basename(path),
    content,
  }));
}

// --- Cleanup ---

/** Known prefixes for Taskless-owned skills (current and legacy) */
const SKILL_PREFIXES = ["taskless-", "use-taskless-"];

/** Known directory names for Taskless-owned commands (current and legacy) */
const COMMAND_DIRS = ["tskl", "taskless"];

/**
 * Remove all Taskless-owned skill directories so a fresh set can be installed.
 * Matches any directory starting with known prefixes.
 */
async function removeOwnedSkills(
  cwd: string,
  tool: ToolDescriptor
): Promise<void> {
  const skillsDirectory = join(cwd, tool.installDir, tool.skills.path);

  let entries: string[];
  try {
    entries = await readdir(skillsDirectory);
  } catch {
    return;
  }

  const owned = entries.filter((name) =>
    SKILL_PREFIXES.some((prefix) => name.startsWith(prefix))
  );

  for (const name of owned) {
    await rm(join(skillsDirectory, name), { recursive: true, force: true });
  }
}

/**
 * Remove all Taskless-owned command directories so a fresh set can be installed.
 * Matches known command directory names.
 */
async function removeOwnedCommands(
  cwd: string,
  tool: ToolDescriptor
): Promise<void> {
  if (!tool.commands) return;

  const commandsBase = join(cwd, tool.installDir, dirname(tool.commands.path));

  for (const directoryName of COMMAND_DIRS) {
    await rm(join(commandsBase, directoryName), {
      recursive: true,
      force: true,
    });
  }
}

// --- Installation ---

export interface InstallResult {
  skills: string[];
  commands: string[];
}

export async function installForTool(
  cwd: string,
  tool: ToolDescriptor,
  skills: EmbeddedSkill[],
  commands: EmbeddedCommand[]
): Promise<InstallResult> {
  const installedSkills: string[] = [];
  const installedCommands: string[] = [];

  // Remove all Taskless-owned skills and commands before installing fresh
  await removeOwnedSkills(cwd, tool);
  await removeOwnedCommands(cwd, tool);

  // Install skills verbatim
  for (const skill of skills) {
    const skillDirectory = join(
      cwd,
      tool.installDir,
      tool.skills.path,
      skill.name
    );
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(join(skillDirectory, "SKILL.md"), skill.content, "utf8");
    installedSkills.push(skill.name);
  }

  // Place commands (Claude Code only)
  if (tool.commands) {
    const commandDirectory = join(cwd, tool.installDir, tool.commands.path);
    await mkdir(commandDirectory, { recursive: true });
    for (const command of commands) {
      await writeFile(
        join(commandDirectory, command.filename),
        command.content,
        "utf8"
      );
      installedCommands.push(command.filename);
    }
  }

  return { skills: installedSkills, commands: installedCommands };
}

// --- Wizard-facing install plan ---

/**
 * Per-target slice of an install plan. Each slice names the tool descriptor
 * to install into plus the explicit skill and command lists the caller chose.
 */
export interface InstallPlanTarget {
  tool: ToolDescriptor;
  skills: EmbeddedSkill[];
  commands: EmbeddedCommand[];
}

/**
 * Full plan handed to {@link applyInstallPlan}. Targets are independent —
 * applying a plan replaces the entire install state, so targets not listed
 * here and that were recorded in the previous install state will be treated
 * as removals and surgically cleaned up.
 */
export interface InstallPlan {
  targets: InstallPlanTarget[];
}

export interface ApplyInstallOptions {
  cliVersion: string;
  now?: () => Date;
}

export interface ApplyInstallResult {
  state: InstallState;
  writtenSkills: Array<{ target: string; skill: string }>;
  writtenCommands: Array<{ target: string; command: string }>;
  removedSkills: Array<{ target: string; skill: string }>;
  removedCommands: Array<{ target: string; command: string }>;
}

/**
 * Tool registry keyed by installDir so state-based cleanup can find the
 * original paths for a target recorded in a previous manifest. The agents
 * fallback is included since prior installs may have written to it.
 */
const ALL_KNOWN_TOOLS: readonly ToolDescriptor[] = [...TOOLS, AGENTS_FALLBACK];

function findToolByInstallDirectory(
  directory: string
): ToolDescriptor | undefined {
  return ALL_KNOWN_TOOLS.find((t) => t.installDir === directory);
}

async function writeSkillFile(
  cwd: string,
  tool: ToolDescriptor,
  skill: EmbeddedSkill
): Promise<void> {
  const skillDirectory = join(
    cwd,
    tool.installDir,
    tool.skills.path,
    skill.name
  );
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(join(skillDirectory, "SKILL.md"), skill.content, "utf8");
}

async function writeCommandFile(
  cwd: string,
  tool: ToolDescriptor,
  command: EmbeddedCommand
): Promise<void> {
  if (!tool.commands) return;
  const commandDirectory = join(cwd, tool.installDir, tool.commands.path);
  await mkdir(commandDirectory, { recursive: true });
  await writeFile(
    join(commandDirectory, command.filename),
    command.content,
    "utf8"
  );
}

async function deleteSkill(
  cwd: string,
  tool: ToolDescriptor,
  skillName: string
): Promise<void> {
  const skillDirectory = join(
    cwd,
    tool.installDir,
    tool.skills.path,
    skillName
  );
  await rm(skillDirectory, { recursive: true, force: true });
}

async function deleteCommand(
  cwd: string,
  tool: ToolDescriptor,
  commandFilename: string
): Promise<void> {
  if (!tool.commands) return;
  const commandPath = join(
    cwd,
    tool.installDir,
    tool.commands.path,
    commandFilename
  );
  await rm(commandPath, { force: true });
}

/**
 * Apply an explicit install plan, using the previously-recorded state in
 * `.taskless/taskless.json` to surgically delete files that are no longer
 * selected. Unlike {@link installForTool}, this function NEVER glob-deletes
 * Taskless-prefixed files — it only touches files recorded in the prior
 * state. First-run installs (no prior state) write all plan files with
 * zero deletions.
 */
export async function applyInstallPlan(
  cwd: string,
  plan: InstallPlan,
  options: ApplyInstallOptions
): Promise<ApplyInstallResult> {
  const previousState = await readInstallState(cwd);
  const now = options.now ?? (() => new Date());

  const nextState: InstallState = {
    installedAt: now().toISOString(),
    cliVersion: options.cliVersion,
    targets: {},
  };

  for (const { tool, skills, commands } of plan.targets) {
    nextState.targets[tool.installDir] = {
      skills: skills.map((s) => s.name),
      commands: commands.map((c) => c.filename),
    };
  }

  const diff = computeInstallDiff(previousState, nextState);

  const removedSkills: Array<{ target: string; skill: string }> = [];
  const removedCommands: Array<{ target: string; command: string }> = [];

  for (const entry of diff.entries) {
    if (
      entry.removals.skills.length === 0 &&
      entry.removals.commands.length === 0
    ) {
      continue;
    }
    const tool = findToolByInstallDirectory(entry.target);
    if (!tool) continue;

    for (const skillName of entry.removals.skills) {
      await deleteSkill(cwd, tool, skillName);
      removedSkills.push({ target: entry.target, skill: skillName });
    }
    for (const commandFilename of entry.removals.commands) {
      await deleteCommand(cwd, tool, commandFilename);
      removedCommands.push({ target: entry.target, command: commandFilename });
    }
  }

  const writtenSkills: Array<{ target: string; skill: string }> = [];
  const writtenCommands: Array<{ target: string; command: string }> = [];

  for (const { tool, skills, commands } of plan.targets) {
    for (const skill of skills) {
      await writeSkillFile(cwd, tool, skill);
      writtenSkills.push({ target: tool.installDir, skill: skill.name });
    }
    for (const command of commands) {
      await writeCommandFile(cwd, tool, command);
      writtenCommands.push({
        target: tool.installDir,
        command: command.filename,
      });
    }
  }

  await writeInstallState(cwd, nextState);

  return {
    state: nextState,
    writtenSkills,
    writtenCommands,
    removedSkills,
    removedCommands,
  };
}

// --- Staleness Check ---

async function readInstalledSkillVersion(
  skillPath: string
): Promise<string | undefined> {
  try {
    const content = await readFile(skillPath, "utf8");
    const parsed = parseFrontmatter(content);
    const metadata = parsed.data.metadata as Record<string, string> | undefined;
    return metadata?.version;
  } catch {
    return undefined;
  }
}

export async function checkStaleness(cwd: string): Promise<ToolStatus[]> {
  const embedded = getEmbeddedSkills();
  const tools = await detectTools(cwd);

  // Include .agents/ fallback if the directory exists (from a previous fallback install)
  const fallbackExists = await stat(join(cwd, AGENTS_FALLBACK.installDir))
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (fallbackExists) {
    tools.push(AGENTS_FALLBACK);
  }

  const results: ToolStatus[] = [];

  for (const tool of tools) {
    const skillStatuses: SkillStatus[] = [];

    for (const skill of embedded) {
      const installedPath = join(
        cwd,
        tool.installDir,
        tool.skills.path,
        skill.name,
        "SKILL.md"
      );
      const installedVersion = await readInstalledSkillVersion(installedPath);
      const currentVersion = skill.metadata.version ?? "unknown";

      skillStatuses.push({
        name: skill.name,
        installedVersion,
        currentVersion,
        current: installedVersion === currentVersion,
      });
    }

    results.push({ name: tool.name, skills: skillStatuses });
  }

  return results;
}
