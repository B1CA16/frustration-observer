// Hesitation detection.
//
// Contract: the pointer entering an observed element starts a timer. Leaving
// the element, or clicking it, cancels that timer. If the timer survives
// `threshold` ms the hesitation is reported once, while the pointer is still
// resting there. Coming back later starts a fresh dwell.

import type { Detector } from "../detector.js";
import type { Emit } from "../emitter.js";
import type { ResolvedHesitationOptions } from "../options.js";

export function createHesitationDetector(
  options: ResolvedHesitationOptions,
  emit: Emit,
): Detector {
  // Keyed by element, iterable so reset() can cancel every pending dwell.
  const dwells = new Map<Element, ReturnType<typeof setTimeout>>();

  function cancel(target: Element): void {
    const timer = dwells.get(target);
    if (timer !== undefined) clearTimeout(timer);
    dwells.delete(target);
  }

  return {
    onEnter(target) {
      cancel(target);
      const enteredAt = Date.now();

      dwells.set(
        target,
        setTimeout(() => {
          dwells.delete(target);
          emit({
            type: "hesitation",
            target,
            timestamp: Date.now(),
            // Measured rather than assumed: a busy page can run the timer
            // late, and the reported duration should say what happened.
            duration: Date.now() - enteredAt,
          });
        }, options.threshold),
      );
    },

    onLeave(target) {
      cancel(target);
    },

    // Clicking is acting, and someone who acted is no longer hesitating.
    onClick(target) {
      cancel(target);
    },

    onUnobserve(target) {
      cancel(target);
    },

    reset() {
      for (const target of [...dwells.keys()]) {
        cancel(target);
      }
    },
  };
}
