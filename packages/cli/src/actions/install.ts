import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";

// Skill files embedded at build time via Vite import.meta.glob
const skillFiles: Record<string, string> = import.meta.glob(
  "../../../../plugins/taskless/skills/**/SKILL.md",
  { query: "?raw", import: "default", eager: true }
);

// --- Types ---

interface ToolDescriptor {
  name: string;
  dir: string;
  skills: {
    path: string;
    prefix: string;
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
      prefix: "taskless-",
    },
    commands: {
      path: "commands/taskless",
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

// --- Skill Installation ---

function buildNamespacedSkillContent(
  skill: EmbeddedSkill,
  prefix: string
): string {
  const parsed = parseFrontmatter(skill.content);
  const data = { ...parsed.data, name: `${prefix}${skill.name}` };
  return stringifyFrontmatter(parsed.content, data);
}

export async function installForTool(
  cwd: string,
  tool: ToolDescriptor,
  skills: EmbeddedSkill[]
): Promise<string[]> {
  const installed: string[] = [];

  for (const skill of skills) {
    // Write SKILL.md
    const skillDirectory = join(
      cwd,
      tool.dir,
      tool.skills.path,
      `${tool.skills.prefix}${skill.name}`
    );
    await mkdir(skillDirectory, { recursive: true });
    const skillContent = buildNamespacedSkillContent(skill, tool.skills.prefix);
    await writeFile(join(skillDirectory, "SKILL.md"), skillContent, "utf8");
    installed.push(`${tool.skills.prefix}${skill.name}`);

    // Write derived command if tool supports commands
    if (tool.commands) {
      const commandDirectory = join(cwd, tool.dir, tool.commands.path);
      await mkdir(commandDirectory, { recursive: true });
      const commandContent = deriveCommand(skill);
      await writeFile(
        join(commandDirectory, `${skill.name}.md`),
        commandContent,
        "utf8"
      );
    }
  }

  return installed;
}

// --- Command Derivation ---

function titleCase(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveCommand(skill: EmbeddedSkill): string {
  const commandData: Record<string, unknown> = {
    name: `"Taskless: ${titleCase(skill.name)}"`,
    description: skill.description,
    category: "Taskless",
    tags: ["taskless"],
    metadata: skill.metadata,
  };
  return stringifyFrontmatter(skill.body, commandData);
}

// --- AGENTS.md ---

const AGENTS_BEGIN_PATTERN = /<!-- BEGIN taskless version .+ -->/;
const AGENTS_END_MARKER = "<!-- END taskless -->";

function buildAgentsMdRegion(version: string): string {
  const lines = [
    `<!-- BEGIN taskless version ${version} -->`,
    "",
    "## Taskless",
    "",
    "Taskless provides agentic workflow skills for this project.",
    "Discover available capabilities using the CLI:",
    "",
    "    pnpm dlx @taskless/cli --help",
    "    npx @taskless/cli --help",
    "",
    "| Command          | Purpose                              |",
    "|------------------|--------------------------------------|",
    "| `taskless info`  | Show version and installation status |",
    "| `taskless init`  | Install or update skills             |",
    "",
    AGENTS_END_MARKER,
  ];
  return lines.join("\n");
}

export async function writeAgentsMd(
  cwd: string,
  version: string
): Promise<void> {
  const filePath = join(cwd, "AGENTS.md");
  const region = buildAgentsMdRegion(version);

  let existing: string | undefined;
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    // File doesn't exist, create it
  }

  if (existing === undefined) {
    await writeFile(filePath, region + "\n", "utf8");
    return;
  }

  const beginMatch = AGENTS_BEGIN_PATTERN.exec(existing);
  const endIndex = existing.indexOf(AGENTS_END_MARKER);

  if (beginMatch !== null && endIndex !== -1) {
    // Replace existing region
    const before = existing.slice(0, beginMatch.index);
    const after = existing.slice(endIndex + AGENTS_END_MARKER.length);
    await writeFile(filePath, before + region + after, "utf8");
  } else {
    // Append region
    await writeFile(
      filePath,
      existing.trimEnd() + "\n\n" + region + "\n",
      "utf8"
    );
  }
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

function parseAgentsMdVersion(content: string): string | undefined {
  const match = /<!-- BEGIN taskless version (.+) -->/.exec(content);
  return match?.[1];
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
        `${tool.skills.prefix}${skill.name}`,
        "SKILL.md"
      );
      const installedVersion = await readInstalledSkillVersion(installedPath);
      const currentVersion = skill.metadata.version ?? "unknown";

      skillStatuses.push({
        name: `${tool.skills.prefix}${skill.name}`,
        installedVersion,
        currentVersion,
        current: installedVersion === currentVersion,
      });
    }

    results.push({ name: tool.name, skills: skillStatuses });
  }

  // Check AGENTS.md too
  try {
    const agentsContent = await readFile(join(cwd, "AGENTS.md"), "utf8");
    const agentsVersion = parseAgentsMdVersion(agentsContent);
    if (agentsVersion !== undefined) {
      results.push({
        name: "AGENTS.md",
        skills: [
          {
            name: "agents-md",
            installedVersion: agentsVersion,
            currentVersion: __VERSION__,
            current: agentsVersion === __VERSION__,
          },
        ],
      });
    }
  } catch {
    // No AGENTS.md, skip
  }

  return results;
}
