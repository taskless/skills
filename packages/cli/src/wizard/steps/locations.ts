import { multiselect, log } from "@clack/prompts";

import {
  DEFAULT_SHIM_DIR,
  SHIM_TARGETS,
  detectTools,
  type ToolDescriptor,
} from "../../install/install";
import { ask } from "../ask";

/** A single entry in the tool-selection multiselect. */
export interface LocationChoice {
  value: string;
  label: string;
  hint: string;
}

/**
 * Build the tool-selection multiselect options and the pre-checked set from
 * the detected tools. Pure — no prompt, no TTY — so the detection-to-choices
 * mapping is unit-testable.
 *
 * Every shim target is always offered (a peer list); the canonical
 * `.taskless/` store is never an entry. Detected tools are pre-checked, and
 * `.agents/` is pre-checked as the default when nothing is detected.
 */
export function locationChoices(detected: ToolDescriptor[]): {
  options: LocationChoice[];
  initialValues: string[];
} {
  const detectedDirectories = new Set(detected.map((t) => t.installDir));
  const initialValues =
    detected.length > 0 ? [...detectedDirectories] : [DEFAULT_SHIM_DIR];

  const options = SHIM_TARGETS.map((shim) => ({
    value: shim.dir,
    label: `${shim.label} (${shim.dir}/)`,
    hint: detectedDirectories.has(shim.dir)
      ? "detected"
      : shim.dir === DEFAULT_SHIM_DIR
        ? "generic agent skills"
        : "not detected",
  }));

  return { options, initialValues };
}

/**
 * Ask which tools to enable Taskless for. The canonical `.taskless/` store is
 * always written and is not offered here — these choices only control which
 * tool directories receive a reference stub.
 */
export async function promptLocations(cwd: string): Promise<string[]> {
  const detected = await detectTools(cwd);
  const { options, initialValues } = locationChoices(detected);

  while (true) {
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
