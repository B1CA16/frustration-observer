import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInteractionObserver } from "../index.js";
import type { DeadClickEvent, InteractionObserverOptions } from "../types.js";

/** Only dead clicks are of interest here; the other detectors stay out. */
function setup(options: InteractionObserverOptions = {}) {
  const observer = createInteractionObserver({
    rageClick: false,
    hesitation: false,
    ...options,
  });
  const events: DeadClickEvent[] = [];
  observer.on("deadclick", (event) => events.push(event));

  const button = document.createElement("button");
  document.body.append(button);
  observer.observe(button);

  return { observer, events, button };
}

function click(target: Element, x = 40, y = 60) {
  target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
  );
}

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

/** Lets the MutationObserver deliver, then runs the pending timers. */
async function wait(ms = 1000) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  setScroll(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dead click detection", () => {
  it("reports a click that changes nothing", async () => {
    const { events, button } = setup();

    click(button);
    await wait();

    expect(events).toHaveLength(1);
    expect(events[0]?.target).toBe(button);
  });

  it("waits the full timeout before reporting", async () => {
    const { events, button } = setup();

    click(button);
    await wait(900);

    expect(events).toHaveLength(0);

    await wait(100);

    expect(events).toHaveLength(1);
  });

  it("stays quiet when the page adds something to the DOM", async () => {
    const { events, button } = setup();

    click(button);
    document.body.append(document.createElement("p"));
    await wait();

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the page changes an attribute", async () => {
    const { events, button } = setup();

    click(button);
    button.setAttribute("aria-busy", "true");
    await wait();

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the page changes some text", async () => {
    const { events, button } = setup();
    const label = document.createTextNode("before");
    document.body.append(label);

    click(button);
    label.data = "after";
    await wait();

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the page scrolls", async () => {
    const { events, button } = setup();

    click(button);
    setScroll(400);
    await wait();

    expect(events).toHaveLength(0);
  });

  it("stays quiet when the page navigates", async () => {
    const { events, button } = setup();

    click(button);
    history.pushState({}, "", "/somewhere-else");
    await wait();

    expect(events).toHaveLength(0);
  });

  it("ignores changes inside elements matched by the ignore selector", async () => {
    const { events, button } = setup({
      deadClick: { ignore: "[data-clock]" },
    });
    const clock = document.createElement("div");
    clock.setAttribute("data-clock", "");
    clock.append(document.createTextNode("12:00"));
    document.body.append(clock);

    click(button);
    clock.firstChild!.textContent = "12:01";
    await wait();

    expect(events).toHaveLength(1);
  });

  it("still notices changes outside the ignored elements", async () => {
    const { events, button } = setup({
      deadClick: { ignore: "[data-clock]" },
    });

    click(button);
    document.body.append(document.createElement("p"));
    await wait();

    expect(events).toHaveLength(0);
  });

  it("carries on when the ignore selector is not valid", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { events, button } = setup({ deadClick: { ignore: "((" } });

    click(button);
    await wait();

    expect(consoleError).toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it("reports one dead click for a burst of clicks", async () => {
    const { events, button } = setup();

    click(button);
    await wait(100);
    click(button);
    await wait(100);
    click(button);
    await wait(1000);

    expect(events).toHaveLength(1);
  });

  it("describes the dead click it detected", async () => {
    const { events, button } = setup();

    click(button, 120, 240);
    await wait();

    const event = events[0];
    expect(event?.type).toBe("deadclick");
    expect(event?.timeout).toBe(1000);
    expect(event?.position).toEqual({ x: 120, y: 240 });
    expect(event?.timestamp).toBeTypeOf("number");
  });

  it("forgets a pending check when the element is unobserved", async () => {
    const { observer, events, button } = setup();

    click(button);
    observer.unobserve(button);
    await wait();

    expect(events).toHaveLength(0);
  });

  it("cancels a pending check on disconnect", async () => {
    const { observer, events, button } = setup();

    click(button);
    observer.disconnect();
    await wait();

    expect(events).toHaveLength(0);
  });

  it("watches the document only while a check is pending", async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { button } = setup();

    click(button);
    expect(disconnect).not.toHaveBeenCalled();

    await wait();

    expect(disconnect).toHaveBeenCalled();
  });

  it("detects nothing when the detector is turned off", async () => {
    const { events, button } = setup({ deadClick: false });

    click(button);
    await wait();

    expect(events).toHaveLength(0);
  });

  it("honours a custom timeout", async () => {
    const { events, button } = setup({ deadClick: { timeout: 300 } });

    click(button);
    await wait(300);

    expect(events).toHaveLength(1);
    expect(events[0]?.timeout).toBe(300);
  });
});
