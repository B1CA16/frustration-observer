// TypeScript decides whether a declaration file describes ESM or CommonJS from
// its extension and the package type. Because this package is "type": "module",
// every .d.ts tsc emits is read as ESM — including the one describing the
// CommonJS build, which makes `require("interaction-observer")` resolve types
// that claim to be something the JavaScript beside them is not.
//
// Copying the entry declaration to .d.cts gives the require condition a
// declaration file that is unambiguously CommonJS. Verified with
// `npx @arethetypeswrong/cli`.

import { copyFileSync } from "node:fs";

copyFileSync("dist/index.d.ts", "dist/index.d.cts");
