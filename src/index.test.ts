import { afterEach, describe, expect, it, vi } from "vitest";

import { createInteractionObserver } from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createInteractionObserver", () => {
  it("returns an observer exposing the public API", () => {
    const observer = createInteractionObserver();

    expect(observer.observe).toBeTypeOf("function");
    expect(observer.unobserve).toBeTypeOf("function");
    expect(observer.disconnect).toBeTypeOf("function");
    expect(observer.on).toBeTypeOf("function");
    expect(observer.off).toBeTypeOf("function");
  });

  it("reports invalid options immediately", () => {
    expect(() =>
      createInteractionObserver({ hesitation: { threshold: 0 } }),
    ).toThrow(RangeError);
  });

  it("touches no document listeners until an element is observed", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");

    createInteractionObserver();

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("observes and disconnects without throwing", () => {
    const observer = createInteractionObserver();
    const button = document.createElement("button");
    document.body.append(button);

    expect(() => {
      observer.observe(button);
      observer.disconnect();
    }).not.toThrow();
  });
});
