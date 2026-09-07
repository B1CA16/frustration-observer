import { describe, expect, it } from "vitest";

import { resolveOptions } from "./options.js";
import type { InteractionObserverOptions } from "./types.js";

/** Runtime validation exists for JavaScript callers, who can pass anything. */
const invalid = (value: unknown) => value as InteractionObserverOptions;

describe("resolveOptions", () => {
  it("returns the documented defaults when given nothing", () => {
    expect(resolveOptions()).toEqual({
      rageClick: { clicks: 3, interval: 1000, radius: 30 },
      hesitation: { threshold: 2000 },
      deadClick: { timeout: 1000, ignore: undefined },
    });
  });

  it("fills the untouched fields of a partially configured detector", () => {
    const resolved = resolveOptions({ rageClick: { clicks: 5 } });

    expect(resolved.rageClick).toEqual({
      clicks: 5,
      interval: 1000,
      radius: 30,
    });
  });

  it("disables a detector configured as false", () => {
    const resolved = resolveOptions({ deadClick: false });

    expect(resolved.deadClick).toBeNull();
  });

  it("leaves the other detectors enabled when one is disabled", () => {
    const resolved = resolveOptions({ deadClick: false });

    expect(resolved.rageClick).not.toBeNull();
    expect(resolved.hesitation).not.toBeNull();
  });

  it("keeps a dead click ignore selector", () => {
    const resolved = resolveOptions({ deadClick: { ignore: ".live-clock" } });

    expect(resolved.deadClick?.ignore).toBe(".live-clock");
  });

  it("rejects options that are not an object", () => {
    expect(() => resolveOptions(invalid(42))).toThrow(TypeError);
    expect(() => resolveOptions(invalid(null))).toThrow(TypeError);
  });

  it("rejects a detector that is neither an object nor false", () => {
    expect(() => resolveOptions(invalid({ rageClick: true }))).toThrow(
      TypeError,
    );
  });

  it("names the offending option in the error message", () => {
    expect(() => resolveOptions(invalid({ rageClick: { clicks: 0 } }))).toThrow(
      /rageClick\.clicks/,
    );
  });

  it("rejects a click threshold below two", () => {
    expect(() => resolveOptions({ rageClick: { clicks: 1 } })).toThrow(
      RangeError,
    );
  });

  it("rejects a fractional click threshold", () => {
    expect(() => resolveOptions({ rageClick: { clicks: 3.5 } })).toThrow(
      RangeError,
    );
  });

  it("rejects a non-numeric duration", () => {
    expect(() =>
      resolveOptions(invalid({ rageClick: { interval: "1000" } })),
    ).toThrow(TypeError);
  });

  it("rejects durations that are not positive", () => {
    expect(() => resolveOptions({ rageClick: { interval: 0 } })).toThrow(
      RangeError,
    );
    expect(() => resolveOptions({ hesitation: { threshold: -1 } })).toThrow(
      RangeError,
    );
    expect(() => resolveOptions({ deadClick: { timeout: 0 } })).toThrow(
      RangeError,
    );
  });

  it("rejects durations that are not finite", () => {
    expect(() =>
      resolveOptions({ hesitation: { threshold: Number.NaN } }),
    ).toThrow(RangeError);
    expect(() =>
      resolveOptions({ hesitation: { threshold: Number.POSITIVE_INFINITY } }),
    ).toThrow(RangeError);
  });

  it("accepts a zero radius, meaning clicks must land on the same pixel", () => {
    expect(resolveOptions({ rageClick: { radius: 0 } }).rageClick?.radius).toBe(
      0,
    );
  });

  it("rejects a negative radius", () => {
    expect(() => resolveOptions({ rageClick: { radius: -1 } })).toThrow(
      RangeError,
    );
  });

  it("rejects an ignore selector that is not a non-empty string", () => {
    expect(() => resolveOptions(invalid({ deadClick: { ignore: 5 } }))).toThrow(
      TypeError,
    );
    expect(() => resolveOptions({ deadClick: { ignore: "" } })).toThrow(
      TypeError,
    );
  });
});
