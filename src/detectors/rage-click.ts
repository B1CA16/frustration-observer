// Rage click detection.
//
// Contract: clicks on an element are kept in a window that stays open for
// `interval` ms after each one. Once `clicks` of them sit inside that window,
// all within `radius` pixels of the first, the burst counts as rage and is
// reported `interval` ms after the last click — late enough to include every
// click of the burst, so one burst produces one event carrying its true count.

import type { Detector } from "../detector.js";
import type { Emit } from "../emitter.js";
import type { ResolvedRageClickOptions } from "../options.js";

interface Click {
  time: number;
  x: number;
  y: number;
}

interface Burst {
  clicks: Click[];
  timer: ReturnType<typeof setTimeout> | undefined;
}

function distance(a: Click, b: Click): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createRageClickDetector(
  options: ResolvedRageClickOptions,
  emit: Emit,
): Detector {
  // A plain Map, not a WeakMap: the observer already holds every element it
  // watches, and reset() has to be able to reach these timers to cancel them.
  const bursts = new Map<Element, Burst>();

  function cancel(target: Element): void {
    const burst = bursts.get(target);
    if (burst?.timer !== undefined) clearTimeout(burst.timer);
    bursts.delete(target);
  }

  /** Reports a finished burst and forgets the element's state. */
  function report(target: Element, clicks: Click[]): void {
    cancel(target);

    const first = clicks[0];
    // Indexed rather than .at(-1), which the ES2020 build target predates.
    const last = clicks[clicks.length - 1];
    if (!first || !last) return;

    emit({
      type: "rageclick",
      target,
      timestamp: Date.now(),
      clicks: clicks.length,
      duration: last.time - first.time,
      radius: Math.max(...clicks.map((click) => distance(click, first))),
      position: { x: last.x, y: last.y },
    });
  }

  return {
    onClick(target, event) {
      const now = Date.now();
      const click: Click = { time: now, x: event.clientX, y: event.clientY };

      const previous = bursts.get(target)?.clicks ?? [];
      // Pruned before anything else, so a click left over from an earlier
      // burst can never inflate the count of the current one.
      const clicks = previous.filter(
        (old) => now - old.time <= options.interval,
      );
      const anchor = clicks[0];

      if (anchor && distance(click, anchor) > options.radius) {
        // Clicking somewhere else ends the burst rather than extending it. If
        // it had already qualified, it is reported now instead of being lost.
        if (clicks.length >= options.clicks) report(target, clicks);
        else cancel(target);

        bursts.set(target, { clicks: [click], timer: undefined });
        return;
      }

      clicks.push(click);
      cancel(target);

      bursts.set(target, {
        clicks,
        // Every further click reschedules the report, so it lands once the
        // user has stopped and carries the whole burst. The timer closes over
        // this exact array, which is the burst as it stands at this click.
        timer:
          clicks.length >= options.clicks
            ? setTimeout(() => report(target, clicks), options.interval)
            : undefined,
      });
    },

    onUnobserve(target) {
      cancel(target);
    },

    reset() {
      for (const target of [...bursts.keys()]) {
        cancel(target);
      }
    },
  };
}
