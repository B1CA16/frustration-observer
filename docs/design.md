# interaction-observer — V1 design

A small, framework-agnostic browser library that detects three meaningful user
interactions with DOM elements: rage clicks, hesitation, and dead clicks.

This document records the design decisions made before implementation, the
precise contract of each detector, and — just as importantly — what V1
deliberately does not do.

## Goals

- Small, intuitive, strongly typed public API.
- Browser-first, framework agnostic, zero runtime dependencies.
- Honest detectors with documented limitations rather than magic.
- Correct lifecycle: everything can be cleaned up.
- Finished and published, not endlessly extended.

## Non-goals

This is a detection primitive, not an analytics product. V1 does not include a
backend, storage, dashboards, session recording, heatmaps, analytics ingestion,
framework adapters, or any form of transport. What you do with the events is
entirely up to the consumer.

## Architecture

The observer attaches a single set of document-level listeners and keeps a
registry of observed elements. Observing 500 elements costs the same as
observing one: there are no per-element listeners.

```
src/
  index.ts          public entry: createInteractionObserver + type re-exports
  types.ts          public types (options, events, observer interface)
  observer.ts       registry, listener attach/detach, target resolution, fan-out
  emitter.ts        typed event emitter; on() returns an unsubscribe function
  options.ts        defaults, merging and validation
  activity.ts       page-activity watcher (mutation / navigation / scroll)
  detectors/
    rage-click.ts
    hesitation.ts
    dead-click.ts
```

When a DOM event fires, `observer.ts` walks up from `event.target` until it
finds a registered element, then fans the event out to the detectors. Detectors
share one small interface, which is what keeps the codebase learnable:

```ts
interface Detector {
  onClick?(target: Element, ev: MouseEvent): void;
  onEnter?(target: Element, ev: MouseEvent): void;
  onLeave?(target: Element): void;
  onUnobserve?(target: Element): void; // drop per-element state
  reset(): void; // drop pending state and timers; reusable afterwards
}
```

Detectors never touch the registry and never read the DOM tree, so each one is
unit-testable in isolation.

### Lifecycle decisions

- **Listeners attach lazily on the first `observe()`.** Importing the package in
  an SSR or Node context therefore touches no browser global and cannot crash.
- **`disconnect()` is reusable.** It detaches listeners, clears all state and
  cancels pending timers; a later `observe()` re-attaches. This mirrors
  `MutationObserver` rather than inventing a permanently-disposed state.
- **Listeners run in the capture phase.** A page handler that calls
  `stopPropagation()` would otherwise hide the very clicks this library exists
  to notice.
- **Observed elements are held in a `Set`.** Removing an element from the DOM
  without calling `unobserve()` keeps it alive. This is documented rather than
  worked around. Detectors key their per-element state by the same elements,
  in a `Map` rather than a `WeakMap`: the registry already holds them, and
  cancelling every pending timer on `disconnect()` requires state that can be
  iterated.

## Public API

```ts
import { createInteractionObserver } from "interaction-observer";

const observer = createInteractionObserver({
  rageClick: { clicks: 3, interval: 1000, radius: 30 },
  hesitation: { threshold: 2000 },
  deadClick: { timeout: 1000, ignore: "[data-io-ignore]" },
});

const off = observer.on("rageclick", (event) => console.log(event));

observer.observe(button);
observer.unobserve(button);
observer.disconnect();
```

The entire surface is `createInteractionObserver`, `on`, `off`, `observe`,
`unobserve`, `disconnect`. `on()` returns an unsubscribe function.

All options are optional and merge with defaults, so `{ rageClick: { clicks: 5 } }`
keeps the default interval and radius. Any detector can be disabled with
`false`, for example `{ deadClick: false }`.

### Defaults

| Detector     | Defaults                                    |
| ------------ | ------------------------------------------- |
| `rageClick`  | `clicks: 3`, `interval: 1000`, `radius: 30` |
| `hesitation` | `threshold: 2000`                           |
| `deadClick`  | `timeout: 1000`, `ignore: undefined`        |

### Event payloads

```ts
type InteractionEvent = RageClickEvent | HesitationEvent | DeadClickEvent;

// every event carries: type, target: Element, timestamp: number

interface RageClickEvent {
  clicks: number;
  duration: number;
  radius: number;
  position: { x: number; y: number };
}

interface HesitationEvent {
  duration: number;
}

interface DeadClickEvent {
  timeout: number;
  position: { x: number; y: number };
}
```

## Detector contracts

### rageclick

Click timestamps and coordinates are kept in a rolling window per element,
pruned to `interval`. Once `clicks` clicks fall inside the window and within
`radius` pixels of the first, the burst is marked live and an emit is scheduled
for `interval` ms after the _last_ click. Further clicks reschedule it and grow
the count.

The result is one event per burst reporting the true total, at the cost of
`interval` ms of latency. Emitting immediately at the threshold instead would
report a count of 3 and then fire again on every subsequent click.

### hesitation

`pointerover` on an observed element starts a timer; `pointerout` or a click
cancels it. If the timer survives `threshold` ms, one event fires while the
pointer is still inside. Re-entering the element starts a fresh dwell.

Pointer movement between child nodes of the observed element does not restart
the dwell — this is the detector's most likely bug and has a dedicated test.

### deadclick

A click on an observed element opens a `timeout` window. Any of the following
cancels it:

- a DOM mutation anywhere in the document that is not matched by `ignore`
- a `location` change
- a scroll position change

If the window elapses untouched, the event fires. At most one check is pending
per element, so a rage burst produces one dead click rather than seven.

A single `MutationObserver` watches `document` with
`subtree`/`childList`/`attributes`/`characterData`, and runs only while at
least one dead-click check is pending. Nothing observes anything while the page
is idle.

## Error handling

- `createInteractionObserver` throws `RangeError` for non-finite or
  non-positive thresholds, and `TypeError` for malformed option objects.
- `observe()` and `unobserve()` throw `TypeError` when given a non-Element.
- Listener errors are isolated: a handler that throws is reported to the console
  and does not prevent the remaining handlers from running.

## Known limitations

These are properties of browser-side detection, not bugs to be fixed later.

- **Dead clicks cannot be detected on continuously mutating pages.** A live
  clock, carousel or chatty third-party script counts as activity and will
  suppress every dead click. The `ignore` selector mitigates the common cases.
- **A click whose only effect is outside the DOM looks dead** — clipboard
  writes, audio playback and analytics beacons are indistinguishable from
  nothing happening.
- **Slow asynchronous responses look dead.** A click that triggers a two-second
  request with a one-second `timeout` is reported as a dead click.
- **Hesitation requires a hover-capable pointer** and therefore effectively does
  not fire on touch devices.

## Code conventions

The published package includes `src`, so the source is part of what ships.
Comments are written accordingly, in two tiers.

**Exported API uses TSDoc.** Every exported function, type and property carries
a TSDoc block, because that text is what appears in a consumer's editor when
they use the package — it is the documentation most users will ever read. Every
duration states its unit, `@throws` documents the error cases, and the entry
point carries an `@example`.

**Internal comments explain why, never what.** The code already states what it
does; a comment restating it adds noise and goes stale. Comments are reserved
for reasoning that the code cannot express — why an operation happens in this
order, why an edge case is handled this way.

Three further rules:

- every file opens with a one or two line header describing its responsibility
- every detector file states the precise contract it implements, mirroring the
  detector contracts above
- no commented-out code, and no `TODO` comments in a release — a TODO is either
  work to do now or an entry in Future Ideas

## Testing strategy

Vitest with jsdom and fake timers. Each detector is tested through the public
API by dispatching synthetic DOM events; the emitter, option validation and
observer lifecycle have their own suites. Lifecycle tests assert that
`disconnect()` removes every listener, cancels every timer, and can be followed
by a fresh `observe()`.

## Build and distribution

`tsup` produces ESM, CJS and IIFE builds with type declarations. The package
publishes only `dist`, declares `sideEffects: false` and exposes a modern
`exports` map. GitHub Actions runs typecheck, tests and build on every push and
pull request, and deploys the demo to GitHub Pages.

## Future ideas

Deliberately out of scope for V1, recorded so they stay out of it:

- selector-based or delegated observation of dynamically added elements
- an aggregate frustration score across detectors
- React / Vue / Svelte adapters
- a visual debug overlay
- `fetch` / `XMLHttpRequest` instrumentation for more accurate dead clicks
- hesitation via keyboard focus, and a touch-friendly equivalent
- event batching and transport helpers
- a `root` option for shadow DOM scoping
