import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInteractionObserver } from "../index.js";
import type { InteractionObserverOptions, ThrashEvent } from "../types.js";

/** Only thrashing is of interest here; the other detectors stay out. */
function setup(options: InteractionObserverOptions = {}) {
  const observer = createInteractionObserver({
    rageClick: false,
    hesitation: false,
    deadClick: false,
    ...options,
  });
  const events: ThrashEvent[] = [];
  observer.on("thrash", (event) => events.push(event));

  const panel = document.createElement("div");
  panel.id = "panel";
  document.body.append(panel);
  observer.observe(panel);

  return { observer, events, panel };
}

function enter(target: Element, from: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent("pointerover", { bubbles: true, relatedTarget: from }),
  );
}

function leave(target: Element) {
  target.dispatchEvent(
    new MouseEvent("pointerout", { bubbles: true, relatedTarget: null }),
  );
}

/** Replays a path, one sample every `step` ms, the way a real pointer would. */
function trace(
  target: Element,
  path: Array<[number, number]>,
  step = 16,
): void {
  for (const [x, y] of path) {
    target.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }),
    );
    vi.advanceTimersByTime(step);
  }
}

/** A straight run across the element, which is most pointer movement. */
function straightPath(): Array<[number, number]> {
  return Array.from({ length: 24 }, (_, i) => [100 + i * 12, 200]);
}

/** A sweeping curve, the shape of a hand moving towards a target. */
function arcPath(): Array<[number, number]> {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = (Math.PI / 2) * (i / 23);
    return [100 + Math.sin(angle) * 260, 400 - Math.cos(angle) * 260] as [
      number,
      number,
    ];
  });
}

/** A hand resting on the mouse while reading. */
function jitterPath(): Array<[number, number]> {
  return Array.from({ length: 40 }, (_, i) => [
    200 + (i % 2 === 0 ? 2 : -2),
    300 + (i % 3 === 0 ? 2 : -1),
  ]);
}

/** Scanning down a list and back up, at reading speed. */
function scanPath(): Array<[number, number]> {
  const down = Array.from({ length: 10 }, (_, i) => [200, 100 + i * 30]);
  const up = Array.from({ length: 10 }, (_, i) => [200, 400 - i * 30]);
  return [...down, ...up, ...down] as Array<[number, number]>;
}

/** Shaking the mouse over one spot, which is the thing being detected. */
function thrashPath(times = 5): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  for (let i = 0; i < times; i += 1) {
    path.push([160, 200], [240, 200]);
  }
  return path;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("thrash detection", () => {
  it("reports the mouse being shaken over an element", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, thrashPath(), 40);

    expect(events).toHaveLength(1);
    expect(events[0]?.target).toBe(panel);
  });

  it("describes the thrashing it detected", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, thrashPath(), 40);

    const event = events[0];
    expect(event?.type).toBe("thrash");
    expect(event?.reversals).toBeGreaterThanOrEqual(6);
    expect(event?.distance).toBeGreaterThan(0);
    expect(event?.duration).toBeGreaterThan(0);
    expect(event?.selector).toBe("#panel");
  });

  it("reports once per burst", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, thrashPath(8), 40);

    expect(events).toHaveLength(1);
  });

  it("re-arms after the pointer leaves and comes back", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, thrashPath(), 40);
    leave(panel);
    enter(panel);
    trace(panel, thrashPath(), 40);

    expect(events).toHaveLength(2);
  });

  it("forgets movement when the element is unobserved", () => {
    const { observer, events, panel } = setup();

    enter(panel);
    trace(panel, thrashPath(2), 40);
    observer.unobserve(panel);
    observer.observe(panel);
    enter(panel);
    trace(panel, thrashPath(2), 40);

    expect(events).toHaveLength(0);
  });

  it("detects nothing when the detector is turned off", () => {
    const { events, panel } = setup({ thrash: false });

    enter(panel);
    trace(panel, thrashPath(8), 40);

    expect(events).toHaveLength(0);
  });

  it("attaches no pointermove listener when the detector is off", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const observer = createInteractionObserver({ thrash: false });
    const panel = document.createElement("div");
    document.body.append(panel);

    observer.observe(panel);

    const listened = addEventListener.mock.calls.map((call) => call[0]);
    expect(listened).not.toContain("pointermove");
  });

  it("honours a custom reversal threshold", () => {
    const { events, panel } = setup({ thrash: { reversals: 20 } });

    enter(panel);
    trace(panel, thrashPath(5), 40);

    expect(events).toHaveLength(0);
  });
});

// Everything below is the question of whether this detector is usable at all.
// Each path is ordinary pointer movement that must never be reported.
describe("thrash detection does not fire on ordinary movement", () => {
  it("stays quiet when the pointer crosses in a straight line", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, straightPath());

    expect(events).toHaveLength(0);
  });

  it("stays quiet on a sweeping curve towards a target", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, arcPath());

    expect(events).toHaveLength(0);
  });

  it("stays quiet while a hand rests on the mouse", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, jitterPath());

    expect(events).toHaveLength(0);
  });

  it("stays quiet while scanning a list up and down", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, scanPath(), 60);

    expect(events).toHaveLength(0);
  });

  it("stays quiet when reversals are spread over several seconds", () => {
    const { events, panel } = setup();

    enter(panel);
    // The same number of reversals as a burst, at a tenth of the speed.
    trace(panel, thrashPath(6), 400);

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the pointer moves back after a pause", () => {
    const { events, panel } = setup();

    enter(panel);
    trace(panel, [
      [100, 200],
      [200, 200],
      [300, 200],
    ]);
    vi.advanceTimersByTime(2000);
    trace(panel, [
      [200, 200],
      [100, 200],
    ]);

    expect(events).toHaveLength(0);
  });
});
