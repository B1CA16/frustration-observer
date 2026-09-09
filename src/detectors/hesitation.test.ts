import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInteractionObserver } from "../index.js";
import type { HesitationEvent, InteractionObserverOptions } from "../types.js";

/** Only hesitation is of interest here; the other detectors stay out. */
function setup(options: InteractionObserverOptions = {}) {
  const observer = createInteractionObserver({
    rageClick: false,
    deadClick: false,
    ...options,
  });
  const events: HesitationEvent[] = [];
  observer.on("hesitation", (event) => events.push(event));

  const button = document.createElement("button");
  document.body.append(button);
  observer.observe(button);

  const elsewhere = document.createElement("div");
  document.body.append(elsewhere);

  return { observer, events, button, elsewhere };
}

function enter(target: Element, from: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent("pointerover", { bubbles: true, relatedTarget: from }),
  );
}

function leave(target: Element, to: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent("pointerout", { bubbles: true, relatedTarget: to }),
  );
}

function click(target: Element) {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("hesitation detection", () => {
  it("reports a pointer that rests past the threshold", () => {
    const { events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(2000);

    expect(events).toHaveLength(1);
    expect(events[0]?.target).toBe(button);
  });

  it("stays quiet before the threshold", () => {
    const { events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(1900);

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the pointer leaves in time", () => {
    const { events, button, elsewhere } = setup();

    enter(button);
    vi.advanceTimersByTime(1000);
    leave(button, elsewhere);
    vi.advanceTimersByTime(5000);

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the user acts before hesitating long enough", () => {
    const { events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(1000);
    click(button);
    vi.advanceTimersByTime(5000);

    expect(events).toHaveLength(0);
  });

  it("reports once, however long the pointer stays", () => {
    const { events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(30_000);

    expect(events).toHaveLength(1);
  });

  it("starts a fresh dwell when the pointer comes back", () => {
    const { events, button, elsewhere } = setup();

    enter(button);
    vi.advanceTimersByTime(2000);
    leave(button, elsewhere);
    enter(button, elsewhere);
    vi.advanceTimersByTime(2000);

    expect(events).toHaveLength(2);
  });

  it("keeps counting while the pointer moves across children", () => {
    const { events, button } = setup();
    const icon = document.createElement("span");
    button.append(icon);

    enter(button);
    vi.advanceTimersByTime(1000);
    // Crossing onto a child looks like leaving and re-entering to the DOM.
    leave(button, icon);
    enter(icon, button);
    vi.advanceTimersByTime(1000);

    expect(events).toHaveLength(1);
    expect(events[0]?.duration).toBe(2000);
  });

  it("describes the hesitation it detected", () => {
    const { events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(2000);

    const event = events[0];
    expect(event?.type).toBe("hesitation");
    expect(event?.duration).toBe(2000);
    expect(event?.timestamp).toBeTypeOf("number");
  });

  it("tracks elements separately", () => {
    const { observer, events, button } = setup();
    const other = document.createElement("button");
    document.body.append(other);
    observer.observe(other);

    enter(button);
    vi.advanceTimersByTime(1000);
    enter(other, button);
    vi.advanceTimersByTime(1000);

    // The button crossed its threshold; the second element is only halfway.
    expect(events).toHaveLength(1);
    expect(events[0]?.target).toBe(button);
  });

  it("forgets a dwell in progress when the element is unobserved", () => {
    const { observer, events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(1000);
    observer.unobserve(button);
    vi.advanceTimersByTime(5000);

    expect(events).toHaveLength(0);
  });

  it("cancels a dwell in progress on disconnect", () => {
    const { observer, events, button } = setup();

    enter(button);
    vi.advanceTimersByTime(1000);
    observer.disconnect();
    vi.advanceTimersByTime(5000);

    expect(events).toHaveLength(0);
  });

  it("detects nothing when the detector is turned off", () => {
    const { events, button } = setup({ hesitation: false });

    enter(button);
    vi.advanceTimersByTime(30_000);

    expect(events).toHaveLength(0);
  });

  it("honours a custom threshold", () => {
    const { events, button } = setup({ hesitation: { threshold: 500 } });

    enter(button);
    vi.advanceTimersByTime(500);

    expect(events).toHaveLength(1);
    expect(events[0]?.duration).toBe(500);
  });
});
