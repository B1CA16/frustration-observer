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

  it("runs every detector at once on a dead, rage-clicked button", async () => {
    vi.useFakeTimers();
    const observer = createInteractionObserver();
    const seen: string[] = [];
    observer.on("rageclick", (event) => seen.push(event.type));
    observer.on("hesitation", (event) => seen.push(event.type));
    observer.on("deadclick", (event) => seen.push(event.type));

    const button = document.createElement("button");
    document.body.append(button);
    observer.observe(button);

    // Hover long enough to hesitate, then rage click a button that does
    // nothing at all.
    button.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2000);
    for (let i = 0; i < 4; i += 1) {
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }),
      );
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(1000);

    expect(seen.sort()).toEqual(["deadclick", "hesitation", "rageclick"]);
    vi.useRealTimers();
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
