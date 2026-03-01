import { defineCommand } from "citty";

export const infoCommand = defineCommand({
  meta: {
    name: "info",
    description: "Show Taskless CLI information",
  },
  run() {
    console.log(JSON.stringify({ version: __VERSION__ }));
  },
});
