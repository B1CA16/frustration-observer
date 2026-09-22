# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 1.2.0

### Added

- Every event now carries `selector`, a CSS selector for its target such as
  `#buy` or `#checkout > div > button:nth-of-type(2)`. Reporting an interaction
  no longer starts by writing code to name the element. Ids are used where
  present, otherwise the element is described by its position; classes are left
  out, since a utility class stack makes a selector unreadable.

An addition. Everything written against 1.1.0 keeps working.

## 1.1.0

### Added

- `observer.on("*", listener)` receives every interaction type, so reporting
  all of them to one place no longer needs three subscriptions. `off("*", …)`
  removes it.
- `observe()` and `unobserve()` accept a CSS selector or any list of elements,
  such as a NodeList or an array, as well as a single element. A selector that
  matches nothing is not an error.

Both are additions. Everything written against 1.0.0 keeps working.

## 1.0.0

First release.

### Added

- `createInteractionObserver(options)`, returning an observer with `observe`,
  `unobserve`, `disconnect`, `on` and `off`.
- `rageclick` detection: repeated clicks on one element, within a radius, inside
  a rolling window. Reported once per burst with the full click count.
- `hesitation` detection: the pointer resting on an element past a threshold
  without acting.
- `deadclick` detection: a click after which nothing changes, judged by DOM
  mutations, navigation and scroll position, with an `ignore` selector for
  elements that change on their own.
- Option validation at creation, throwing `TypeError` for the wrong type and
  `RangeError` for values that cannot work.
- ESM, CommonJS and standalone browser builds with TypeScript declarations for
  each.
