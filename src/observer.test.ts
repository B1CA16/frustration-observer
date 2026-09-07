import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObserver } from "./observer.js";
import type { Detector } from "./detector.js";
import type { Emit } from "./emitter.js";

function createFakeDetector() {
  return {
    onClick: vi.fn(),
    onEnter: vi.fn(),
    onLeave: vi.fn(),
    onUnobserve: vi.fn(),
    reset: vi.fn(),
  } satisfies Detector;
}

/** An observer wired to a single fake detector, plus the detector itself. */
function setup() {
  const detector = createFakeDetector();
  let emit: Emit = () => {};
  const observer = createObserver((forward) => {
    emit = forward;
    return [detector];
  });

  return {
    observer,
    detector,
    emit: (...args: Parameters<Emit>) => emit(...args),
  };
}

function appendElement(tag = "div"): HTMLElement {
  const element = document.createElement(tag);
  document.body.append(element);
  return element;
}

function click(target: Element, init: MouseEventInit = {}) {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
}

function pointerOver(target: Element, relatedTarget: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent("pointerover", { bubbles: true, relatedTarget }),
  );
}

function pointerOut(target: Element, relatedTarget: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent("pointerout", { bubbles: true, relatedTarget }),
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("observer lifecycle", () => {
  it("touches no browser API until the first observe", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");

    setup();

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("attaches document listeners on the first observe", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const { observer } = setup();

    observer.observe(appendElement());

    expect(addEventListener).toHaveBeenCalled();
  });

  it("reports a click once when several elements are observed", () => {
    const { observer, detector } = setup();
    const first = appendElement();
    const second = appendElement();

    observer.observe(first);
    observer.observe(second);
    click(first);

    expect(detector.onClick).toHaveBeenCalledOnce();
  });

  it("reports a click once when the same element is observed twice", () => {
    const { observer, detector } = setup();
    const element = appendElement();

    observer.observe(element);
    observer.observe(element);
    click(element);

    expect(detector.onClick).toHaveBeenCalledOnce();
  });

  it("removes document listeners once the last element is unobserved", () => {
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const { observer } = setup();
    const element = appendElement();

    observer.observe(element);
    observer.unobserve(element);

    expect(removeEventListener).toHaveBeenCalled();
  });

  it("keeps listening while other elements remain observed", () => {
    const { observer, detector } = setup();
    const first = appendElement();
    const second = appendElement();

    observer.observe(first);
    observer.observe(second);
    observer.unobserve(first);
    click(second);

    expect(detector.onClick).toHaveBeenCalledOnce();
  });

  it("stops reporting clicks on an unobserved element", () => {
    const { observer, detector } = setup();
    const element = appendElement();

    observer.observe(element);
    observer.unobserve(element);
    click(element);

    expect(detector.onClick).not.toHaveBeenCalled();
  });

  it("tells the detectors to forget an unobserved element", () => {
    const { observer, detector } = setup();
    const element = appendElement();

    observer.observe(element);
    observer.unobserve(element);

    expect(detector.onUnobserve).toHaveBeenCalledExactlyOnceWith(element);
  });

  it("stops reporting anything after disconnect", () => {
    const { observer, detector } = setup();
    const element = appendElement();

    observer.observe(element);
    observer.disconnect();
    click(element);

    expect(detector.onClick).not.toHaveBeenCalled();
  });

  it("removes document listeners on disconnect", () => {
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const { observer } = setup();

    observer.observe(appendElement());
    observer.disconnect();

    expect(removeEventListener).toHaveBeenCalled();
  });

  it("resets the detectors on disconnect", () => {
    const { observer, detector } = setup();

    observer.observe(appendElement());
    observer.disconnect();

    expect(detector.reset).toHaveBeenCalledOnce();
  });

  it("can be used again after disconnect", () => {
    const { observer, detector } = setup();
    const element = appendElement();

    observer.observe(element);
    observer.disconnect();
    observer.observe(element);
    click(element);

    expect(detector.onClick).toHaveBeenCalledOnce();
  });

  it("keeps event listeners registered across a disconnect", () => {
    const { observer, emit } = setup();
    const listener = vi.fn();

    observer.on("rageclick", listener);
    observer.observe(appendElement());
    observer.disconnect();
    emit({
      type: "rageclick",
      target: appendElement(),
      timestamp: 0,
      clicks: 3,
      duration: 100,
      radius: 4,
      position: { x: 0, y: 0 },
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("rejects anything that is not an element", () => {
    const { observer } = setup();
    const notAnElement = "#button" as unknown as Element;

    expect(() => observer.observe(notAnElement)).toThrow(TypeError);
    expect(() => observer.unobserve(notAnElement)).toThrow(TypeError);
  });
});

describe("observer event routing", () => {
  it("reports a click on an observed element", () => {
    const { observer, detector } = setup();
    const element = appendElement("button");

    observer.observe(element);
    click(element);

    expect(detector.onClick.mock.calls[0]?.[0]).toBe(element);
  });

  it("reports a click on a descendant as a click on the observed element", () => {
    const { observer, detector } = setup();
    const element = appendElement("button");
    const icon = document.createElement("span");
    element.append(icon);

    observer.observe(element);
    click(icon);

    expect(detector.onClick.mock.calls[0]?.[0]).toBe(element);
  });

  it("ignores clicks outside every observed element", () => {
    const { observer, detector } = setup();

    observer.observe(appendElement());
    click(appendElement());

    expect(detector.onClick).not.toHaveBeenCalled();
  });

  it("reports the pointer entering an observed element", () => {
    const { observer, detector } = setup();
    const element = appendElement();

    observer.observe(element);
    pointerOver(element, appendElement());

    expect(detector.onEnter.mock.calls[0]?.[0]).toBe(element);
  });

  it("ignores pointer movement between children of the observed element", () => {
    const { observer, detector } = setup();
    const element = appendElement();
    const first = document.createElement("span");
    const second = document.createElement("span");
    element.append(first, second);

    observer.observe(element);
    pointerOver(first, null);
    pointerOver(second, first);

    expect(detector.onEnter).toHaveBeenCalledOnce();
  });

  it("reports the pointer leaving an observed element", () => {
    const { observer, detector } = setup();
    const element = appendElement();
    const outside = appendElement();

    observer.observe(element);
    pointerOver(element, outside);
    pointerOut(element, outside);

    expect(detector.onLeave).toHaveBeenCalledExactlyOnceWith(element);
  });

  it("does not report leaving when the pointer moves onto a child", () => {
    const { observer, detector } = setup();
    const element = appendElement();
    const child = document.createElement("span");
    element.append(child);

    observer.observe(element);
    pointerOver(element, null);
    pointerOut(element, child);

    expect(detector.onLeave).not.toHaveBeenCalled();
  });

  it("delivers detector events to listeners registered with on", () => {
    const { observer, emit } = setup();
    const element = appendElement();
    const listener = vi.fn();

    observer.on("hesitation", listener);
    emit({
      type: "hesitation",
      target: element,
      timestamp: 0,
      duration: 2000,
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops delivering events once the returned unsubscribe is called", () => {
    const { observer, emit } = setup();
    const listener = vi.fn();

    const unsubscribe = observer.on("hesitation", listener);
    unsubscribe();
    emit({
      type: "hesitation",
      target: appendElement(),
      timestamp: 0,
      duration: 2000,
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
