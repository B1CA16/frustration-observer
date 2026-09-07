// The contract every detector implements. The observer resolves which observed
// element a DOM event belongs to and calls these methods; detectors decide
// what, if anything, that means. They never read the DOM tree themselves.

/**
 * All methods are optional except `reset`, so a detector only implements the
 * signals it cares about.
 */
export interface Detector {
  /** A click landed on an observed element or one of its descendants. */
  onClick?(target: Element, event: MouseEvent): void;
  /** The pointer entered an observed element from outside it. */
  onEnter?(target: Element, event: MouseEvent): void;
  /** The pointer left an observed element entirely. */
  onLeave?(target: Element): void;
  /** An element stopped being observed; drop any state held for it. */
  onUnobserve?(target: Element): void;
  /**
   * Drop all pending state and timers. Called on disconnect, and the detector
   * must be usable again afterwards.
   */
  reset(): void;
}
