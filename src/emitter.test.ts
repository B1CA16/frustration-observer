import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmitter } from "./emitter.js";
import type { HesitationEvent, RageClickEvent } from "./types.js";

const rageClick = (): RageClickEvent => ({
  type: "rageclick",
  target: document.createElement("button"),
  timestamp: 1000,
  clicks: 3,
  duration: 420,
  radius: 12,
  position: { x: 10, y: 20 },
});

const hesitation = (): HesitationEvent => ({
  type: "hesitation",
  target: document.createElement("button"),
  timestamp: 1000,
  duration: 2000,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEmitter", () => {
  it("calls listeners registered for the emitted type", () => {
    const emitter = createEmitter();
    const listener = vi.fn();
    const event = rageClick();

    emitter.on("rageclick", listener);
    emitter.emit(event);

    expect(listener).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("does not call listeners registered for another type", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("hesitation", listener);
    emitter.emit(rageClick());

    expect(listener).not.toHaveBeenCalled();
  });

  it("calls every listener registered for the type", () => {
    const emitter = createEmitter();
    const first = vi.fn();
    const second = vi.fn();

    emitter.on("rageclick", first);
    emitter.on("rageclick", second);
    emitter.emit(rageClick());

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("registers the same listener only once", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("rageclick", listener);
    emitter.on("rageclick", listener);
    emitter.emit(rageClick());

    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops calling a listener removed through the returned unsubscribe", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    const unsubscribe = emitter.on("rageclick", listener);
    unsubscribe();
    emitter.emit(rageClick());

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops calling a listener removed through off", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("hesitation", listener);
    emitter.off("hesitation", listener);
    emitter.emit(hesitation());

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps calling the remaining listeners when one throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const emitter = createEmitter();
    const failing = vi.fn(() => {
      throw new Error("listener exploded");
    });
    const listener = vi.fn();

    emitter.on("rageclick", failing);
    emitter.on("rageclick", listener);
    emitter.emit(rageClick());

    expect(listener).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("calls the remaining listeners when one unsubscribes during emit", () => {
    const emitter = createEmitter();
    const listener = vi.fn();
    const unsubscribe = emitter.on("rageclick", () => unsubscribe());

    emitter.on("rageclick", listener);
    emitter.emit(rageClick());

    expect(listener).toHaveBeenCalledOnce();
  });

  it("calls a wildcard listener for every type", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("*", listener);
    emitter.emit(rageClick());
    emitter.emit(hesitation());

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("calls both the wildcard and the type listener", () => {
    const emitter = createEmitter();
    const wildcard = vi.fn();
    const specific = vi.fn();

    emitter.on("*", wildcard);
    emitter.on("rageclick", specific);
    emitter.emit(rageClick());

    expect(wildcard).toHaveBeenCalledOnce();
    expect(specific).toHaveBeenCalledOnce();
  });

  it("stops calling a wildcard listener once it unsubscribes", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    const unsubscribe = emitter.on("*", listener);
    unsubscribe();
    emitter.emit(rageClick());

    expect(listener).not.toHaveBeenCalled();
  });

  it("removes a wildcard listener through off", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("*", listener);
    emitter.off("*", listener);
    emitter.emit(rageClick());

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps calling the other listeners when a wildcard listener throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("*", () => {
      throw new Error("listener exploded");
    });
    emitter.on("rageclick", listener);
    emitter.emit(rageClick());

    expect(listener).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("removes every listener on clear", () => {
    const emitter = createEmitter();
    const listener = vi.fn();

    emitter.on("rageclick", listener);
    emitter.clear();
    emitter.emit(rageClick());

    expect(listener).not.toHaveBeenCalled();
  });
});
