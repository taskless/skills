import { multiselect } from "@clack/prompts";

import { getOptionalSkillNames } from "../../install/catalog";
import { ask } from "../ask";

export async function promptOptionalSkills(): Promise<string[]> {
  const options = getOptionalSkillNames();

  if (options.length === 0) {
    return [];
  }

  const selected = await ask("optionalSkills", () =>
    multiselect<string>({
      message: "Any optional skills to include?",
      options: options.map((name) => ({
        value: name,
        label: name,
        hint: describe(name),
      })),
      initialValues: [],
      required: false,
    })
  );

  return selected;
}

function describe(name: string): string | undefined {
  switch (name) {
    case "taskless-ci": {
      return "Integrate Taskless with your CI pipeline";
    }
    default: {
      return undefined;
    }
  }
}
