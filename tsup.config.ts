import { defineConfig } from "tsup";

// tsup builds the JavaScript; type declarations are emitted separately by tsc
// (see tsconfig.build.json), which keeps the build independent of the
// TypeScript version tsup happens to bundle internally.
export default defineConfig([
  // Package build: consumed by bundlers, which do their own minification.
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    target: "es2020",
    sourcemap: true,
    treeshake: true,
    clean: true,
  },
  // Standalone build: dropped straight into a <script> tag from a CDN,
  // so this one is minified.
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "InteractionObserver",
    target: "es2020",
    minify: true,
    sourcemap: true,
  },
]);
