import { multiselect, log } from "@clack/prompts";

import { detectTools } from "../../install/install";
import { ask } from "../ask";

export interface LocationChoice {
  installDir: string;
  label: string;
  hint?: string;
}

const ALL_LOCATIONS: LocationChoice[] = [
  { installDir: ".claude", label: ".claude/" },
  { installDir: ".opencode", label: ".opencode/" },
  { installDir: ".cursor", label: ".cursor/" },
  {
    installDir: ".agents",
    label: ".agents/",
    hint: "fallback for unknown tools",
  },
];

export async function promptLocations(cwd: string): Promise<string[]> {
  const detected = await detectTools(cwd);
  const detectedDirectories = new Set(detected.map((t) => t.installDir));
  const detectedNamesByDirectory = new Map<string, string[]>();
  for (const tool of detected) {
    const existing = detectedNamesByDirectory.get(tool.installDir) ?? [];
    existing.push(tool.name);
    detectedNamesByDirectory.set(tool.installDir, existing);
  }

  while (true) {
    const options = ALL_LOCATIONS.map((loc) => ({
      value: loc.installDir,
      label: loc.label,
      hint: detectedDirectories.has(loc.installDir)
        ? `detected (${(detectedNamesByDirectory.get(loc.installDir) ?? []).join(", ")})`
        : (loc.hint ?? "not detected"),
    }));

    const selected = await ask("locations", () =>
      multiselect<string>({
        message: "Where should Taskless skills be installed?",
        options,
        initialValues: [...detectedDirectories],
        required: false,
      })
    );

    if (selected.length === 0) {
      log.error("Select at least one install location.");
      continue;
    }

    return selected;
  }
}
