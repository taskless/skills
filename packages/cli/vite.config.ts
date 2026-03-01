import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function shebang(): Plugin {
  return {
    name: "shebang",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          chunk.code = "#!/usr/bin/env node\n" + chunk.code;
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [tsconfigPaths(), shebang()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [/^node:/],
    },
  },
});
