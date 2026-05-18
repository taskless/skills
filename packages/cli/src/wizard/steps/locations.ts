import { multiselect, log } from "@clack/prompts";

import {
  DEFAULT_SHIM_DIR,
  SHIM_TARGETS,
  detectTools,
} from "../../install/install";
import { ask } from "../ask";

/**
 * Ask which tools to enable Taskless for. The canonical `.taskless/` store is
 * always written and is not offered here — these choices only control which
 * tool directories receive a reference stub.
 */
export async function promptLocations(cwd: string): Promise<string[]> {
  const detected = await detectTools(cwd);
  const detectedDirectories = new Set(detected.map((t) => t.installDir));
  const initialValues =
    detected.length > 0 ? [...detectedDirectories] : [DEFAULT_SHIM_DIR];

  while (true) {
    const options = SHIM_TARGETS.map((shim) => ({
      value: shim.dir,
      label: `${shim.label} (${shim.dir}/)`,
      hint: detectedDirectories.has(shim.dir)
        ? "detected"
        : shim.dir === DEFAULT_SHIM_DIR
          ? "generic agent skills"
          : "not detected",
    }));

    const selected = await ask("locations", () =>
      multiselect<string>({
        message: "Which tools do you want to enable Taskless for?",
        options,
        initialValues,
        required: false,
      })
    );

    if (selected.length === 0) {
      log.error("Select at least one tool.");
      continue;
    }

    return selected;
  }
}
