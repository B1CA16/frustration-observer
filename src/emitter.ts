// Minimal typed event emitter used to deliver interaction events to listeners.
// It knows nothing about the DOM: detectors hand it events, it hands them on.

import type {
  AnyInteractionListener,
  InteractionEvent,
  InteractionListener,
  InteractionType,
  Unsubscribe,
} from "./types.js";

/** A type, or `"*"` for every type. */
type ListenerKey = InteractionType | "*";

export interface Emitter {
  on<T extends InteractionType>(
    type: T,
    listener: InteractionListener<T>,
  ): Unsubscribe;
  on(type: "*", listener: AnyInteractionListener): Unsubscribe;
  off<T extends InteractionType>(
    type: T,
    listener: InteractionListener<T>,
  ): void;
  off(type: "*", listener: AnyInteractionListener): void;
  emit(event: InteractionEvent): void;
  clear(): void;
}

/** How a detector reports a detected interaction. */
export type Emit = (event: InteractionEvent) => void;

export function createEmitter(): Emitter {
  // A Set per key, so registering the same listener twice registers it once,
  // matching how addEventListener behaves.
  const listeners = new Map<ListenerKey, Set<AnyInteractionListener>>();

  function add(
    type: ListenerKey,
    listener: AnyInteractionListener,
  ): Unsubscribe {
    let forType = listeners.get(type);
    if (!forType) {
      forType = new Set();
      listeners.set(type, forType);
    }
    forType.add(listener);

    return () => {
      forType.delete(listener);
    };
  }

  function remove(type: ListenerKey, listener: AnyInteractionListener): void {
    listeners.get(type)?.delete(listener);
  }

  function deliver(type: ListenerKey, event: InteractionEvent): void {
    const forType = listeners.get(type);
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
  }

  return {
    // The overloads live on the Emitter interface; the implementation takes
    // the widened key and listener, which is what the cast reconciles.
    on: add as Emitter["on"],
    off: remove as Emitter["off"],

    emit(event) {
      deliver(event.type, event);
      deliver("*", event);
    },

    clear() {
      listeners.clear();
    },
  };
}
