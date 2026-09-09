# interaction-observer

[![npm](https://img.shields.io/npm/v/interaction-observer)](https://www.npmjs.com/package/interaction-observer)
[![CI](https://github.com/B1CA16/interaction-observer/actions/workflows/ci.yml/badge.svg)](https://github.com/B1CA16/interaction-observer/actions/workflows/ci.yml)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/interaction-observer)](https://bundlephobia.com/package/interaction-observer)
[![license](https://img.shields.io/npm/l/interaction-observer)](LICENSE)

Detect rage clicks, hesitation and dead clicks on any DOM element. 2.4 KB
minified and gzipped, no dependencies, no framework.

**[Try the live demo](https://b1ca16.github.io/interaction-observer/)**

```ts
import { createInteractionObserver } from "interaction-observer";

const observer = createInteractionObserver();

observer.on("rageclick", (event) => {
  console.log(`${event.clicks} clicks in ${event.duration}ms`);
});

observer.observe(document.querySelector("#buy")!);
```

## What it detects

| Event        | Fires when                                                              |
| ------------ | ----------------------------------------------------------------------- |
| `rageclick`  | Several clicks land on one element, in one spot, inside a short window. |
| `hesitation` | The pointer rests on an element for a while without acting.             |
| `deadclick`  | A click is followed by nothing changing on the page.                    |

## Why it exists

Analytics tell you that someone abandoned a checkout. They rarely tell you that
the person clicked "Complete purchase" seven times first, or hovered over the
price for four seconds, or pressed a button that quietly did nothing. Those are
the moments worth fixing, and they are all visible from the browser.

This library detects them and hands you an event. What you do with it, whether
that is logging, sending it somewhere, or highlighting the element in
development, is entirely up to you.

## Install

```sh
npm install interaction-observer
```

Or use it straight from a CDN, which exposes a global called
`InteractionObserver`:

```html
<script src="https://unpkg.com/interaction-observer"></script>
```

## Usage

```ts
import { createInteractionObserver } from "interaction-observer";

const observer = createInteractionObserver({
  rageClick: { clicks: 3, interval: 1000, radius: 30 },
  hesitation: { threshold: 2000 },
  deadClick: { timeout: 1000, ignore: "[data-live]" },
});

observer.on("rageclick", (event) => report(event));
observer.on("hesitation", (event) => report(event));
observer.on("deadclick", (event) => report(event));

for (const element of document.querySelectorAll("button")) {
  observer.observe(element);
}
```

Every detector is enabled with sensible defaults, so
`createInteractionObserver()` on its own works. Options merge with the
defaults, and any detector can be switched off:

```ts
createInteractionObserver({ hesitation: false });
```

Observing a parent covers everything inside it. A click on an icon within a
button is reported as a click on the button.

## Configuration

| Option                 | Type     | Default | Meaning                                                             |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------- |
| `rageClick.clicks`     | `number` | `3`     | Clicks required before a burst counts. Whole number, minimum 2.     |
| `rageClick.interval`   | `number` | `1000`  | Milliseconds the window stays open after each click.                |
| `rageClick.radius`     | `number` | `30`    | Pixels the clicks may spread from the first one.                    |
| `hesitation.threshold` | `number` | `2000`  | Milliseconds the pointer must rest before hesitating.               |
| `deadClick.timeout`    | `number` | `1000`  | Milliseconds to wait for the page to react.                         |
| `deadClick.ignore`     | `string` | none    | CSS selector for elements whose changes do not count as a reaction. |

Unusable values are rejected when the observer is created, not silently
ignored: a `TypeError` for the wrong type, a `RangeError` for a number that
cannot work.

## Events

Every event carries `type`, `target` (the observed element) and `timestamp`.

```ts
interface RageClickEvent {
  type: "rageclick";
  target: Element;
  timestamp: number;
  clicks: number; // total clicks in the burst
  duration: number; // milliseconds from first to last
  radius: number; // pixels from the first click to the furthest
  position: { x: number; y: number }; // viewport position of the last click
}

interface HesitationEvent {
  type: "hesitation";
  target: Element;
  timestamp: number;
  duration: number; // milliseconds the pointer had rested
}

interface DeadClickEvent {
  type: "deadclick";
  target: Element;
  timestamp: number;
  timeout: number; // milliseconds waited before giving up
  position: { x: number; y: number };
}
```

A rage click is reported once per burst, one interval after the last click, so
the count is the whole burst rather than the moment the threshold was crossed.

## Cleanup

```ts
const off = observer.on("rageclick", handler); // on() returns an unsubscribe
off();

observer.unobserve(element); // stop watching one element
observer.disconnect(); // stop watching everything
```

`disconnect()` removes the library's document listeners, forgets every observed
element and cancels anything pending. Listeners registered with `on()` survive
it, so the observer can be used again by observing another element, the same
way `MutationObserver` behaves.

Elements are held by strong reference. Removing an element from the DOM without
calling `unobserve()` keeps it alive, so tear down when a view goes away.

## Browser support

Any browser with pointer events and `MutationObserver`. The build targets
ES2020, which means Chrome 80, Edge 80, Firefox 74 and Safari 14 or newer. No
polyfills are needed.

Importing the package touches no browser API, so it is safe in server-rendered
apps. Listeners are attached on the first `observe()` call.

## Limitations

These come from what a browser can actually see, and are not planned to change.

- **A page that changes constantly hides its dead clicks.** A clock, carousel
  or chat widget counts as the page reacting. The `ignore` selector covers the
  common cases.
- **A click whose only effect is outside the DOM looks dead.** Writing to the
  clipboard or playing audio changes nothing observable.
- **Slow responses look dead.** A click that starts a two second request with a
  one second `timeout` is reported as a dead click.
- **Hesitation needs a hover-capable pointer**, so it does not fire on touch
  screens.

## Non-goals

This is a detection primitive, not an analytics product. It does not include,
and will not grow, a backend, storage, dashboards, session recording, heatmaps,
analytics ingestion, or any transport for the events it produces. Sending them
somewhere is one line of your code, and every product needs that line to be
different.

## Roadmap

Ideas that are deliberately not in v1:

- selector-based observation of elements added later
- an aggregate frustration score across detectors
- React, Vue and Svelte adapters
- a visual debug overlay
- `fetch` instrumentation for more accurate dead clicks
- hesitation through keyboard focus, and a touch equivalent

## Design notes

[`docs/design.md`](docs/design.md) records why the library is built this way:
the precise contract of each detector, the alternatives that were rejected, and
what was left out of v1 on purpose.

## License

MIT
