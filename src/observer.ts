// The core of the library: keeps the set of observed elements, owns the
// document listeners, and works out which observed element a DOM event belongs
// to before handing it to the detectors.

import type { Detector } from "./detector.js";
import { createEmitter, type Emit } from "./emitter.js";
import { selectorFor } from "./selector.js";
import type { InteractionObserver, ObserveTarget } from "./types.js";

const PREFIX = "[frustration-observer]";

// Listeners run in the capture phase, on the way down the tree, so a page
// handler that calls stopPropagation() cannot hide the interaction from us.
const CAPTURE = true;

function describe(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Iterable<unknown>)[Symbol.iterator] === "function"
  );
}

/**
 * Accepts one element, a CSS selector, or any list of elements, and returns
 * the elements to act on. A selector that matches nothing is not a mistake,
 * so it yields an empty list rather than throwing.
 *
 * Strings are checked before iterables on purpose: a string is iterable, and
 * would otherwise be read as a list of single characters.
 */
function toElements(target: unknown, method: string): Element[] {
  if (typeof target === "string") {
    try {
      return [...document.querySelectorAll(target)];
    } catch {
      throw new TypeError(
        `${PREFIX} ${method}() was given an invalid CSS selector: ${target}`,
      );
    }
  }

  if (target instanceof Element) return [target];

  if (isIterable(target)) {
    const elements = [...target];
    for (const element of elements) {
      if (!(element instanceof Element)) {
        throw new TypeError(
          `${PREFIX} ${method}() was given a list holding ${describe(element)}, which is not an Element`,
        );
      }
    }
    return elements as Element[];
  }

  throw new TypeError(
    `${PREFIX} ${method}() expects an Element, a CSS selector or a list of Elements, received ${describe(target)}`,
  );
}

/**
 * Builds an observer around the detectors produced by `createDetectors`, which
 * receives the function detectors call to report an interaction.
 */
export function createObserver(
  createDetectors: (emit: Emit) => Detector[],
): InteractionObserver {
  const emitter = createEmitter();

  // Detectors report what happened; describing the element is the observer's
  // job, because it is the only part that reads the DOM tree.
  const detectors = createDetectors((detected) =>
    emitter.emit({ ...detected, selector: selectorFor(detected.target) }),
  );
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

  function handlePointerMove(event: Event) {
    const pointerEvent = event as MouseEvent;
    const target = resolveTarget(pointerEvent.target);
    if (!target) return;
    for (const detector of detectors) {
      detector.onMove?.(target, pointerEvent);
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

  // pointermove fires far more often than anything else here, so it is only
  // listened for when a detector actually asked for it.
  const watchesMovement = detectors.some((detector) => detector.onMove);

  // Nothing is attached until the first element is observed, which keeps
  // importing this module safe outside a browser.
  function attach() {
    if (attached) return;
    document.addEventListener("click", handleClick, CAPTURE);
    document.addEventListener("pointerover", handlePointerOver, CAPTURE);
    document.addEventListener("pointerout", handlePointerOut, CAPTURE);
    if (watchesMovement) {
      document.addEventListener("pointermove", handlePointerMove, CAPTURE);
    }
    attached = true;
  }

  function detach() {
    if (!attached) return;
    document.removeEventListener("click", handleClick, CAPTURE);
    document.removeEventListener("pointerover", handlePointerOver, CAPTURE);
    document.removeEventListener("pointerout", handlePointerOut, CAPTURE);
    if (watchesMovement) {
      document.removeEventListener("pointermove", handlePointerMove, CAPTURE);
    }
    attached = false;
  }

  return {
    observe(target: ObserveTarget) {
      const elements = toElements(target, "observe");
      for (const element of elements) {
        if (targets.has(element)) continue;
        targets.add(element);
      }
      if (targets.size > 0) attach();
    },

    unobserve(target: ObserveTarget) {
      for (const element of toElements(target, "unobserve")) {
        if (!targets.delete(element)) continue;
        for (const detector of detectors) {
          detector.onUnobserve?.(element);
        }
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

    // Passed through rather than wrapped: the emitter already carries exactly
    // these overloads, and re-declaring them here would only be a place for
    // the two to drift apart.
    on: emitter.on,
    off: emitter.off,
  };
}
