// Minimal typed event emitter used to deliver interaction events to listeners.
// It knows nothing about the DOM: detectors hand it events, it hands them on.

import type {
  InteractionEvent,
  InteractionListener,
  InteractionType,
  Unsubscribe,
} from "./types.js";

type AnyListener = InteractionListener<InteractionType>;

export interface Emitter {
  on<T extends InteractionType>(
    type: T,
    listener: InteractionListener<T>,
  ): Unsubscribe;
  off<T extends InteractionType>(
    type: T,
    listener: InteractionListener<T>,
  ): void;
  emit(event: InteractionEvent): void;
  clear(): void;
}

/** How a detector reports a detected interaction. */
export type Emit = (event: InteractionEvent) => void;

export function createEmitter(): Emitter {
  // A Set per type, so registering the same listener twice registers it once,
  // matching how addEventListener behaves.
  const listeners = new Map<InteractionType, Set<AnyListener>>();

  return {
    on(type, listener) {
      let forType = listeners.get(type);
      if (!forType) {
        forType = new Set();
        listeners.set(type, forType);
      }
      forType.add(listener as AnyListener);

      return () => {
        forType.delete(listener as AnyListener);
      };
    },

    off(type, listener) {
      listeners.get(type)?.delete(listener as AnyListener);
    },

    emit(event) {
      const forType = listeners.get(event.type);
      if (!forType) return;

      // Copied before iterating so a listener that unsubscribes itself, or
      // registers another, cannot disturb this delivery.
      for (const listener of [...forType]) {
        try {
          listener(event);
        } catch (error) {
          // One broken listener must not stop the others, and must not
          // propagate back into the DOM event that triggered detection.
          console.error(
            "[frustration-observer] a listener threw while handling an event",
            error,
          );
        }
      }
    },

    clear() {
      listeners.clear();
    },
  };
}
