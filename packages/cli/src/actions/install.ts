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

interface ToolDescriptor {
  name: string;
  dir: string;
  skills: {
    path: string;
  };
  commands?: {
    path: string;
  };
}

interface EmbeddedSkill {
  name: string;
  description: string;
  content: string;
  body: string;
  metadata: Record<string, string>;
}

interface EmbeddedCommand {
  filename: string;
  content: string;
}

interface SkillStatus {
  name: string;
  installedVersion: string | undefined;
  currentVersion: string;
  current: boolean;
}

interface ToolStatus {
  name: string;
  skills: SkillStatus[];
}

// --- Tool Registry ---

const TOOLS: ToolDescriptor[] = [
  {
    name: "Claude Code",
    dir: ".claude",
    skills: {
      path: "skills",
    },
    commands: {
      path: "commands/tskl",
    },
  },
];

// --- Detection ---

export async function detectTools(cwd: string): Promise<ToolDescriptor[]> {
  const results = await Promise.all(
    TOOLS.map(async (tool) => {
      const exists = await stat(join(cwd, tool.dir))
        .then((s) => s.isDirectory())
        .catch(() => false);
      return exists ? tool : undefined;
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
  const skillsDirectory = join(cwd, tool.dir, tool.skills.path);

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

  const commandsBase = join(cwd, tool.dir, dirname(tool.commands.path));

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
    const skillDirectory = join(cwd, tool.dir, tool.skills.path, skill.name);
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(join(skillDirectory, "SKILL.md"), skill.content, "utf8");
    installedSkills.push(skill.name);
  }

  // Place commands (Claude Code only)
  if (tool.commands) {
    const commandDirectory = join(cwd, tool.dir, tool.commands.path);
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
  const results: ToolStatus[] = [];

  for (const tool of tools) {
    const skillStatuses: SkillStatus[] = [];

    for (const skill of embedded) {
      const installedPath = join(
        cwd,
        tool.dir,
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
