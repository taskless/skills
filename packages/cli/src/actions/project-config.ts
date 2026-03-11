import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isValidSpecVersion,
  isScaffoldVersionSufficient,
  MIN_SCAFFOLD_VERSION,
} from "../capabilities";

/** Typed project configuration from .taskless/taskless.json */
export interface ProjectConfig {
  version: string;
  orgId?: number;
  repositoryUrl?: string;
}

/** Read and parse .taskless/taskless.json */
export async function readProjectConfig(cwd: string): Promise<ProjectConfig> {
  const configPath = join(cwd, ".taskless", "taskless.json");

  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    throw new Error(
      ".taskless/taskless.json not found. Run `taskless init` to set up your project."
    );
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(".taskless/taskless.json is not valid JSON.");
  }

  if (typeof config.version !== "string") {
    throw new TypeError(
      '.taskless/taskless.json is missing the "version" field.'
    );
  }

  if (!isValidSpecVersion(config.version)) {
    throw new Error(
      `Invalid spec version "${config.version}" in .taskless/taskless.json. Expected YYYY-MM-DD format.`
    );
  }

  // Check that the version is at least the lowest minimum across all subcommands
  let lowestMinimum: string | undefined;
  for (const minimum of Object.values(MIN_SCAFFOLD_VERSION)) {
    if (lowestMinimum === undefined || minimum < lowestMinimum) {
      lowestMinimum = minimum;
    }
  }
  if (lowestMinimum && config.version < lowestMinimum) {
    throw new Error(
      `Spec version ${config.version} is not supported by this CLI. Run \`taskless update-engine\` to update.`
    );
  }

  return {
    version: config.version,
    orgId: typeof config.orgId === "number" ? config.orgId : undefined,
    repositoryUrl:
      typeof config.repositoryUrl === "string"
        ? config.repositoryUrl
        : undefined,
  };
}

/** Validate that the config has the fields required for rules generation */
export function validateRulesConfig(
  config: ProjectConfig
): { valid: true } | { valid: false; error: string } {
  if (!isScaffoldVersionSufficient("rules create", config.version)) {
    const required = MIN_SCAFFOLD_VERSION["rules create"]!;
    return {
      valid: false,
      error: `Scaffold version ${config.version} is below the minimum ${required} required for 'taskless rules create'. Run \`taskless update-engine\` to update.`,
    };
  }

  if (config.orgId === undefined) {
    return {
      valid: false,
      error:
        'Missing "orgId" in .taskless/taskless.json. This field is required for rule generation.',
    };
  }

  if (config.repositoryUrl === undefined) {
    return {
      valid: false,
      error:
        'Missing "repositoryUrl" in .taskless/taskless.json. This field is required for rule generation.',
    };
  }

  return { valid: true };
}
