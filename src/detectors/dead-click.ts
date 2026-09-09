// Dead click detection.
//
// Contract: a click on an observed element opens a window of `timeout` ms. If
// the document mutates in a way the `ignore` selector does not excuse, or the
// page navigates, or the scroll position moves, the click did something and
// the window is closed quietly. If the window runs out untouched, the click is
// reported as dead. One check per element, so a burst reports once.
//
// This is a proxy, not the truth: a page that mutates continuously hides every
// dead click, and a click whose only effect is outside the DOM looks dead.
// Those limits are documented rather than worked around.

import { createActivityWatcher } from "../activity.js";
import type { Detector } from "../detector.js";
import type { Emit } from "../emitter.js";
import type { ResolvedDeadClickOptions } from "../options.js";
import type { Point } from "../types.js";

interface Check {
  timer: ReturnType<typeof setTimeout>;
  /** What the page looked like at the moment of the click. */
  href: string;
  scrollX: number;
  scrollY: number;
  position: Point;
}

export function createDeadClickDetector(
  options: ResolvedDeadClickOptions,
  emit: Emit,
): Detector {
  const checks = new Map<Element, Check>();

  // Any activity on the page answers the question for every pending click at
  // once: something happened, so none of them were dead.
  const activity = createActivityWatcher(options.ignore, () => {
    cancelAll();
  });

  function cancel(target: Element): void {
    const check = checks.get(target);
    if (check) clearTimeout(check.timer);
    checks.delete(target);
    // Nothing to wait for means nothing to watch for.
    if (checks.size === 0) activity.stop();
  }

  function cancelAll(): void {
    for (const target of [...checks.keys()]) {
      cancel(target);
    }
  }

  /** The window ran out: decide whether anything moved while it was open. */
  function settle(target: Element): void {
    const check = checks.get(target);
    cancel(target);
    if (!check) return;

    const navigated = location.href !== check.href;
    const scrolled =
      window.scrollX !== check.scrollX || window.scrollY !== check.scrollY;
    if (navigated || scrolled) return;

    emit({
      type: "deadclick",
      target,
      timestamp: Date.now(),
      timeout: options.timeout,
      position: check.position,
    });
  }

  return {
    onClick(target, event) {
      // One check per element: a fresh click restarts the window rather than
      // queueing a second one, so a rage burst reports a single dead click.
      const existing = checks.get(target);
      if (existing) clearTimeout(existing.timer);

      checks.set(target, {
        timer: setTimeout(() => settle(target), options.timeout),
        href: location.href,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        position: { x: event.clientX, y: event.clientY },
      });

      activity.start();
    },

    onUnobserve(target) {
      cancel(target);
    },

    reset() {
      cancelAll();
      // cancelAll stops the watcher only if checks were pending.
      activity.stop();
    },
  };
}
