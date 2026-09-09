import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

// GitHub Pages serves a project site from /<repo>/, so assets need that
// prefix. The demo resolves the package to the source next door, which keeps
// hot reload working while editing the library itself.
export default defineConfig({
  base: "/frustration-observer/",
  resolve: {
    alias: {
      "frustration-observer": fileURLToPath(
        new URL("../src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
