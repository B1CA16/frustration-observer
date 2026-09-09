// Watches the document for signs that the page reacted to something.
//
// Only DOM mutations need a live subscription: navigation and scrolling leave
// state that can simply be compared before and after, so the dead click
// detector snapshots those itself rather than listening for them.

import type { ResolvedDeadClickOptions } from "./options.js";

const PREFIX = "[interaction-observer]";

export interface ActivityWatcher {
  /** Begins watching. Calling it again while watching does nothing. */
  start(): void;
  /** Stops watching and releases the underlying MutationObserver. */
  stop(): void;
}

/**
 * @param onActivity Called the first time a mutation that counts is seen.
 */
export function createActivityWatcher(
  ignore: ResolvedDeadClickOptions["ignore"],
  onActivity: () => void,
): ActivityWatcher {
  let observer: MutationObserver | undefined;
  let selector = ignore;
  let selectorChecked = false;

  /**
   * A bad selector would otherwise throw on every mutation, inside a page that
   * has nothing to do with the mistake. Reporting it once and carrying on
   * without the filter keeps the host page working.
   */
  function checkSelector(): void {
    if (selectorChecked || !selector) return;
    selectorChecked = true;
    try {
      document.querySelector(selector);
    } catch {
      console.error(
        `${PREFIX} deadClick.ignore is not a valid CSS selector, so it will be ignored: ${selector}`,
      );
      selector = undefined;
    }
  }

  /** Changes inside an ignored element are the page talking to itself. */
  function counts(record: MutationRecord): boolean {
    if (!selector) return true;
    const node = record.target;
    const element = node instanceof Element ? node : node.parentElement;
    return !element?.closest(selector);
  }

  return {
    start() {
      if (observer) return;
      checkSelector();

      observer = new MutationObserver((records) => {
        if (records.some(counts)) onActivity();
      });
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    },

    stop() {
      observer?.disconnect();
      observer = undefined;
    },
  };
}
