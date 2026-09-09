// Public entry point of the package.

import type { Detector } from "./detector.js";
import { createDeadClickDetector } from "./detectors/dead-click.js";
import { createHesitationDetector } from "./detectors/hesitation.js";
import { createRageClickDetector } from "./detectors/rage-click.js";
import { createObserver } from "./observer.js";
import { resolveOptions } from "./options.js";
import type {
  InteractionObserver,
  InteractionObserverOptions,
} from "./types.js";

/**
 * Creates an observer that watches elements for signs of user frustration.
 *
 * Every detector is enabled with sensible defaults; pass `false` to turn one
 * off, or an object to tune it. Nothing is attached to the document until the
 * first `observe()` call, so importing this module is safe on the server.
 *
 * @throws TypeError if an option has the wrong shape or type.
 * @throws RangeError if an option is a number that cannot work, such as a
 * threshold of zero.
 *
 * @example
 * const observer = createInteractionObserver({ rageClick: { clicks: 5 } });
 * observer.on("rageclick", (event) => console.log(event.clicks));
 * observer.observe(document.querySelector("button")!);
 */
export function createInteractionObserver(
  options: InteractionObserverOptions = {},
): InteractionObserver {
  // Validating at creation means a mistake throws here, next to the code that
  // caused it, rather than showing up later as detection that never fires.
  const resolved = resolveOptions(options);

  return createObserver((emit) => {
    const detectors: Detector[] = [];
    if (resolved.rageClick) {
      detectors.push(createRageClickDetector(resolved.rageClick, emit));
    }
    if (resolved.hesitation) {
      detectors.push(createHesitationDetector(resolved.hesitation, emit));
    }
    if (resolved.deadClick) {
      detectors.push(createDeadClickDetector(resolved.deadClick, emit));
    }
    return detectors;
  });
}

export type {
  DeadClickEvent,
  DeadClickOptions,
  HesitationEvent,
  HesitationOptions,
  InteractionEvent,
  InteractionEventMap,
  InteractionListener,
  InteractionObserver,
  InteractionObserverOptions,
  InteractionType,
  Point,
  RageClickEvent,
  RageClickOptions,
  Unsubscribe,
} from "./types.js";
