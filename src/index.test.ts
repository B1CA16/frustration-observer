import { describe, expect, it } from "vitest";

// Placeholder suite: replaced by the real API tests in the next milestone.
describe("entry point", () => {
  it("can be imported", async () => {
    await expect(import("./index.js")).resolves.toBeDefined();
  });
});
