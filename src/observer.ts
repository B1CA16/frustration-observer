// The core of the library: keeps the set of observed elements, owns the
// document listeners, and works out which observed element a DOM event belongs
// to before handing it to the detectors.

import type { Detector } from "./detector.js";
import { createEmitter, type Emit } from "./emitter.js";
import type { InteractionObserver } from "./types.js";

const PREFIX = "[interaction-observer]";

// Listeners run in the capture phase, on the way down the tree, so a page
// handler that calls stopPropagation() cannot hide the interaction from us.
const CAPTURE = true;

function describe(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/**
 * Builds an observer around the detectors produced by `createDetectors`, which
 * receives the function detectors call to report an interaction.
 */
export function createObserver(
  createDetectors: (emit: Emit) => Detector[],
): InteractionObserver {
  const emitter = createEmitter();
  const detectors = createDetectors(emitter.emit);
  const targets = new Set<Element>();

  let attached = false;

  /** The observed element this node sits in, if any. */
  function resolveTarget(node: EventTarget | null): Element | null {
    let current = node instanceof Element ? node : null;
    while (current) {
      if (targets.has(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  function handleClick(event: Event) {
    const target = resolveTarget(event.target);
    if (!target) return;
    for (const detector of detectors) {
      detector.onClick?.(target, event as MouseEvent);
    }
  }

  function handlePointerOver(event: Event) {
    const pointerEvent = event as MouseEvent;
    const target = resolveTarget(pointerEvent.target);
    if (!target) return;
    // The pointer crossing between descendants of the same observed element
    // leaves and re-enters in DOM terms, but has not gone anywhere.
    if (resolveTarget(pointerEvent.relatedTarget) === target) return;
    for (const detector of detectors) {
      detector.onEnter?.(target, pointerEvent);
    }
  }

  function handlePointerOut(event: Event) {
    const pointerEvent = event as MouseEvent;
    const target = resolveTarget(pointerEvent.target);
    if (!target) return;
    if (resolveTarget(pointerEvent.relatedTarget) === target) return;
    for (const detector of detectors) {
      detector.onLeave?.(target);
    }
  }

  // Nothing is attached until the first element is observed, which keeps
  // importing this module safe outside a browser.
  function attach() {
    if (attached) return;
    document.addEventListener("click", handleClick, CAPTURE);
    document.addEventListener("pointerover", handlePointerOver, CAPTURE);
    document.addEventListener("pointerout", handlePointerOut, CAPTURE);
    attached = true;
  }

  function detach() {
    if (!attached) return;
    document.removeEventListener("click", handleClick, CAPTURE);
    document.removeEventListener("pointerover", handlePointerOver, CAPTURE);
    document.removeEventListener("pointerout", handlePointerOut, CAPTURE);
    attached = false;
  }

  function assertElement(
    value: unknown,
    method: string,
  ): asserts value is Element {
    if (!(value instanceof Element)) {
      throw new TypeError(
        `${PREFIX} ${method}() expects an Element, received ${describe(value)}`,
      );
    }
  }

  return {
    observe(target) {
      assertElement(target, "observe");
      if (targets.has(target)) return;
      targets.add(target);
      attach();
    },

    unobserve(target) {
      assertElement(target, "unobserve");
      if (!targets.delete(target)) return;
      for (const detector of detectors) {
        detector.onUnobserve?.(target);
      }
      if (targets.size === 0) detach();
    },

    disconnect() {
      detach();
      targets.clear();
      for (const detector of detectors) {
        detector.reset();
      }
      // Listeners registered with on() survive, so the observer can be
      // reconnected simply by observing another element.
    },

    on(type, listener) {
      return emitter.on(type, listener);
    },

    off(type, listener) {
      emitter.off(type, listener);
    },
  };
}
