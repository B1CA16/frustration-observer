import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInteractionObserver } from "../index.js";
import type { InteractionObserverOptions, RageClickEvent } from "../types.js";

/** Only rage clicks are of interest here; the other detectors stay out. */
function setup(options: InteractionObserverOptions = {}) {
  const observer = createInteractionObserver({
    hesitation: false,
    deadClick: false,
    ...options,
  });
  const events: RageClickEvent[] = [];
  observer.on("rageclick", (event) => events.push(event));

  const button = document.createElement("button");
  document.body.append(button);
  observer.observe(button);

  return { observer, events, button };
}

function click(target: Element, x = 100, y = 100) {
  target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
  );
}

/** Clicks land 20ms apart, well inside the default one second window. */
function clickBurst(target: Element, times: number, x = 100, y = 100) {
  for (let i = 0; i < times; i += 1) {
    click(target, x, y);
    vi.advanceTimersByTime(20);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rage click detection", () => {
  it("reports a burst that reaches the click threshold", () => {
    const { events, button } = setup();

    clickBurst(button, 3);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
    expect(events[0]?.target).toBe(button);
  });

  it("stays quiet below the click threshold", () => {
    const { events, button } = setup();

    clickBurst(button, 2);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the clicks are too far apart in time", () => {
    const { events, button } = setup();

    click(button);
    vi.advanceTimersByTime(1200);
    click(button);
    vi.advanceTimersByTime(1200);
    click(button);
    vi.advanceTimersByTime(1200);

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the clicks are too far apart on screen", () => {
    const { events, button } = setup();

    click(button, 100, 100);
    vi.advanceTimersByTime(20);
    click(button, 300, 100);
    vi.advanceTimersByTime(20);
    click(button, 500, 100);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);
  });

  it("waits for the burst to finish before reporting", () => {
    const { events, button } = setup();

    clickBurst(button, 3);

    expect(events).toHaveLength(0);

    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
  });

  it("reports the whole burst once, not once per click past the threshold", () => {
    const { events, button } = setup();

    clickBurst(button, 7);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
    expect(events[0]?.clicks).toBe(7);
  });

  it("describes the burst it detected", () => {
    const { events, button } = setup();

    click(button, 100, 100);
    vi.advanceTimersByTime(200);
    click(button, 110, 100);
    vi.advanceTimersByTime(200);
    click(button, 100, 112);
    vi.advanceTimersByTime(1000);

    const event = events[0];
    expect(event?.type).toBe("rageclick");
    expect(event?.clicks).toBe(3);
    expect(event?.duration).toBe(400);
    expect(event?.radius).toBe(12);
    expect(event?.position).toEqual({ x: 100, y: 112 });
    expect(event?.timestamp).toBeTypeOf("number");
  });

  it("reports a second burst after the first one is over", () => {
    const { events, button } = setup();

    clickBurst(button, 3);
    vi.advanceTimersByTime(1000);
    clickBurst(button, 3);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(2);
  });

  it("reports a finished burst when the pointer moves on and keeps clicking", () => {
    const { events, button } = setup();

    clickBurst(button, 3, 100, 100);
    click(button, 400, 400);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
    expect(events[0]?.clicks).toBe(3);
  });

  it("counts each element separately", () => {
    const { observer, events, button } = setup();
    const other = document.createElement("button");
    document.body.append(other);
    observer.observe(other);

    // Four clicks in total, but only the button ever reaches three.
    clickBurst(button, 2);
    clickBurst(other, 2);
    click(button);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
    expect(events[0]?.target).toBe(button);
    expect(events[0]?.clicks).toBe(3);
  });

  it("forgets a burst in progress when the element is unobserved", () => {
    const { observer, events, button } = setup();

    clickBurst(button, 3);
    observer.unobserve(button);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);
  });

  it("cancels a burst in progress on disconnect", () => {
    const { observer, events, button } = setup();

    clickBurst(button, 3);
    observer.disconnect();
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);
  });

  it("detects nothing when the detector is turned off", () => {
    const { events, button } = setup({ rageClick: false });

    clickBurst(button, 6);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);
  });

  it("honours a custom click threshold", () => {
    const { events, button } = setup({ rageClick: { clicks: 5 } });

    clickBurst(button, 4);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);

    clickBurst(button, 5);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
  });

  it("honours a custom window", () => {
    const { events, button } = setup({ rageClick: { interval: 300 } });

    // Clicks 200ms apart are a burst under the default window, but never more
    // than two of them fit inside a 300ms one.
    click(button);
    vi.advanceTimersByTime(200);
    click(button);
    vi.advanceTimersByTime(200);
    click(button);
    vi.advanceTimersByTime(300);

    expect(events).toHaveLength(0);
  });

  it("honours a custom radius", () => {
    const { events, button } = setup({ rageClick: { radius: 5 } });

    click(button, 100, 100);
    vi.advanceTimersByTime(20);
    click(button, 108, 100);
    vi.advanceTimersByTime(20);
    click(button, 116, 100);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(0);
  });
});
