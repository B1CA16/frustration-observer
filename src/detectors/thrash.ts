// Thrash detection: the pointer shaken back and forth over an element.
//
// Contract: while the pointer is inside an observed element, movements of at
// least NOISE pixels are recorded. A movement that turns more than ninety
// degrees from the one before it counts as a reversal. Once `reversals` of
// them fall inside `interval`, the shaking is reported once. The element
// re-arms when the pointer leaves, or after a spell of `interval` with no
// qualifying movement.
//
// The thresholds exist to keep ordinary movement out. A straight run, a curve
// towards a target and a hand resting on the mouse all produce no reversals at
// all; scanning a list produces two or three, spread over seconds. The test
// file replays each of those paths and asserts silence.

import type { Detector } from "../detector.js";
import type { Emit } from "../emitter.js";
import type { ResolvedThrashOptions } from "../options.js";

/**
 * Movements under this many pixels are treated as a hand resting rather than
 * a direction. Not an option: it describes human hands, not a preference.
 */
const NOISE = 8;

interface Movement {
  time: number;
  distance: number;
  reversal: boolean;
}

interface Trail {
  /** Where the pointer was when a movement was last recorded. */
  last: { x: number; y: number } | null;
  /** The direction it was travelling in. */
  heading: { x: number; y: number } | null;
  moves: Movement[];
  lastTime: number;
  reported: boolean;
}

function freshTrail(): Trail {
  return { last: null, heading: null, moves: [], lastTime: 0, reported: false };
}

export function createThrashDetector(
  options: ResolvedThrashOptions,
  emit: Emit,
): Detector {
  const trails = new Map<Element, Trail>();

  return {
    onEnter(target) {
      trails.set(target, freshTrail());
    },

    onMove(target, event) {
      const now = Date.now();
      let trail = trails.get(target) ?? freshTrail();

      // A quiet spell ends whatever was happening, which is also what re-arms
      // an element that has already been reported.
      if (trail.lastTime && now - trail.lastTime > options.interval) {
        trail = freshTrail();
      }

      const point = { x: event.clientX, y: event.clientY };

      if (!trail.last) {
        trail.last = point;
        trail.lastTime = now;
        trails.set(target, trail);
        return;
      }

      const step = { x: point.x - trail.last.x, y: point.y - trail.last.y };
      const distance = Math.hypot(step.x, step.y);

      // Deliberately leaves `last` alone, so a slow drift accumulates into a
      // real movement instead of being ignored forever.
      if (distance < NOISE) {
        trails.set(target, trail);
        return;
      }

      // A negative dot product means the pointer turned by more than ninety
      // degrees, which is a reversal rather than a curve.
      const reversal = trail.heading
        ? step.x * trail.heading.x + step.y * trail.heading.y < 0
        : false;

      trail.moves.push({ time: now, distance, reversal });
      trail.moves = trail.moves.filter(
        (move) => now - move.time <= options.interval,
      );
      trail.last = point;
      trail.heading = step;
      trail.lastTime = now;
      trails.set(target, trail);

      const reversals = trail.moves.filter((move) => move.reversal).length;
      if (trail.reported || reversals < options.reversals) return;

      const first = trail.moves[0];
      trail.reported = true;
      emit({
        type: "thrash",
        target,
        timestamp: now,
        reversals,
        duration: first ? now - first.time : 0,
        distance: Math.round(
          trail.moves.reduce((total, move) => total + move.distance, 0),
        ),
      });
    },

    onLeave(target) {
      trails.delete(target);
    },

    onUnobserve(target) {
      trails.delete(target);
    },

    reset() {
      trails.clear();
    },
  };
}
