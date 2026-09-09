# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

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
