// Public type surface of the package: the options accepted by
// createInteractionObserver, the events it emits, and the observer it returns.

/** The interactions this library can detect. */
export type InteractionType = "rageclick" | "hesitation" | "deadclick";

/** Fields carried by every interaction event. */
export interface InteractionEventBase {
  /** Which interaction was detected. */
  type: InteractionType;
  /** The observed element the interaction happened on. */
  target: Element;
  /** When the interaction was detected, as a `Date.now()` timestamp. */
  timestamp: number;
}

/** A point in viewport coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** Repeated clicks on the same element in the same spot. */
export interface RageClickEvent extends InteractionEventBase {
  type: "rageclick";
  /** Total clicks in the burst, which is at least the configured `clicks`. */
  clicks: number;
  /** Milliseconds between the first and last click of the burst. */
  duration: number;
  /** Distance in pixels from the first click to the furthest one. */
  radius: number;
  /** Viewport position of the last click in the burst. */
  position: Point;
}

/** A long pause over an element before doing anything with it. */
export interface HesitationEvent extends InteractionEventBase {
  type: "hesitation";
  /** Milliseconds the pointer had rested on the element when detected. */
  duration: number;
}

/** A click that produced no observable change on the page. */
export interface DeadClickEvent extends InteractionEventBase {
  type: "deadclick";
  /** Milliseconds waited for a change before giving up. */
  timeout: number;
  /** Viewport position of the click. */
  position: Point;
}

/** Maps each interaction type to the event its listeners receive. */
export interface InteractionEventMap {
  rageclick: RageClickEvent;
  hesitation: HesitationEvent;
  deadclick: DeadClickEvent;
}

/** Any event this library emits. */
export type InteractionEvent = InteractionEventMap[InteractionType];

/** Receives events of a single interaction type. */
export type InteractionListener<T extends InteractionType> = (
  event: InteractionEventMap[T],
) => void;

/** Removes the listener it was returned for. Safe to call more than once. */
export type Unsubscribe = () => void;

/** Tuning for rage click detection. */
export interface RageClickOptions {
  /**
   * Clicks required before a burst counts as rage. Whole number, minimum 2.
   * @defaultValue 3
   */
  clicks?: number;
  /**
   * Milliseconds the burst window stays open after each click.
   * @defaultValue 1000
   */
  interval?: number;
  /**
   * Pixels the clicks may spread from the first one. `0` requires every click
   * to land on the same pixel.
   * @defaultValue 30
   */
  radius?: number;
}

/** Tuning for hesitation detection. */
export interface HesitationOptions {
  /**
   * Milliseconds the pointer must rest on an element before hesitating.
   * @defaultValue 2000
   */
  threshold?: number;
}

/** Tuning for dead click detection. */
export interface DeadClickOptions {
  /**
   * Milliseconds to wait for the page to react to a click.
   * @defaultValue 1000
   */
  timeout?: number;
  /**
   * CSS selector for elements whose changes do not count as a reaction, such
   * as a clock that keeps ticking on its own.
   */
  ignore?: string;
}

/**
 * Options accepted by {@link createInteractionObserver}. Every detector is
 * enabled with sensible defaults; pass `false` to turn one off.
 */
export interface InteractionObserverOptions {
  rageClick?: RageClickOptions | false;
  hesitation?: HesitationOptions | false;
  deadClick?: DeadClickOptions | false;
}

/** Watches elements for signs of user frustration. */
export interface InteractionObserver {
  /**
   * Starts watching an element. The first call attaches the library's event
   * listeners to the document. Observing the same element twice does nothing.
   *
   * @throws TypeError if `target` is not an Element.
   */
  observe(target: Element): void;
  /**
   * Stops watching an element and forgets anything in progress on it. The
   * document listeners are removed once no elements remain.
   *
   * @throws TypeError if `target` is not an Element.
   */
  unobserve(target: Element): void;
  /**
   * Stops watching every element, removes the document listeners and cancels
   * pending detection. Event listeners registered with {@link on} are kept, so
   * the observer can be used again by calling {@link observe}.
   */
  disconnect(): void;
  /**
   * Registers a listener for one interaction type.
   *
   * @returns A function that removes the listener.
   */
  on<T extends InteractionType>(
    type: T,
    listener: InteractionListener<T>,
  ): Unsubscribe;
  /** Removes a listener registered with {@link on}. */
  off<T extends InteractionType>(
    type: T,
    listener: InteractionListener<T>,
  ): void;
}
