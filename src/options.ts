// Turns the user's options into a fully resolved configuration, applying
// defaults and rejecting values that cannot work. Validation runs once, at
// creation, so a mistake surfaces immediately instead of as silence later.

import type {
  DeadClickOptions,
  HesitationOptions,
  InteractionObserverOptions,
  RageClickOptions,
} from "./types.js";

const PREFIX = "[interaction-observer]";

export interface ResolvedRageClickOptions {
  clicks: number;
  interval: number;
  radius: number;
}

export interface ResolvedHesitationOptions {
  threshold: number;
}

export interface ResolvedDeadClickOptions {
  timeout: number;
  ignore: string | undefined;
}

/** A detector resolved to `null` is disabled. */
export interface ResolvedOptions {
  rageClick: ResolvedRageClickOptions | null;
  hesitation: ResolvedHesitationOptions | null;
  deadClick: ResolvedDeadClickOptions | null;
}

export const DEFAULTS = {
  rageClick: { clicks: 3, interval: 1000, radius: 30 },
  hesitation: { threshold: 2000 },
  deadClick: { timeout: 1000, ignore: undefined },
} as const satisfies ResolvedOptions;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Milliseconds: any positive, finite number. */
function readDuration(value: unknown, path: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number") {
    throw new TypeError(
      `${PREFIX} ${path} must be a number of milliseconds, received ${typeof value}`,
    );
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `${PREFIX} ${path} must be a positive, finite number of milliseconds, received ${value}`,
    );
  }
  return value;
}

/** Pixels: any finite number from zero upwards. */
function readDistance(value: unknown, path: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number") {
    throw new TypeError(
      `${PREFIX} ${path} must be a number of pixels, received ${typeof value}`,
    );
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `${PREFIX} ${path} must be a finite number of pixels of zero or more, received ${value}`,
    );
  }
  return value;
}

function readClickCount(
  value: unknown,
  path: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number") {
    throw new TypeError(
      `${PREFIX} ${path} must be a number, received ${typeof value}`,
    );
  }
  // Fewer than two clicks is not a burst, and a fraction can never be reached.
  if (!Number.isInteger(value) || value < 2) {
    throw new RangeError(
      `${PREFIX} ${path} must be a whole number of at least 2, received ${value}`,
    );
  }
  return value;
}

function readSelector(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(
      `${PREFIX} ${path} must be a non-empty CSS selector string`,
    );
  }
  return value;
}

/**
 * Reads one detector's options. `false` disables it, an absent value takes the
 * defaults, and anything that is not an object is a mistake worth reporting.
 */
function readSection<Raw, Resolved>(
  value: Raw | false | undefined,
  path: string,
  resolve: (raw: Raw) => Resolved,
): Resolved | null {
  if (value === false) return null;
  if (value === undefined) return resolve({} as Raw);
  if (!isObject(value)) {
    throw new TypeError(
      `${PREFIX} ${path} must be an options object or false, received ${typeof value}`,
    );
  }
  return resolve(value);
}

/**
 * Deliberately not a type guard: narrowing the argument here would replace the
 * declared option types with a plain record and lose them for the rest of the
 * function.
 */
function assertOptionsObject(value: unknown): void {
  if (!isObject(value)) {
    throw new TypeError(
      `${PREFIX} options must be an object, received ${value === null ? "null" : typeof value}`,
    );
  }
}

export function resolveOptions(
  options: InteractionObserverOptions = {},
): ResolvedOptions {
  assertOptionsObject(options);

  return {
    rageClick: readSection<RageClickOptions, ResolvedRageClickOptions>(
      options.rageClick,
      "rageClick",
      (raw) => ({
        clicks: readClickCount(
          raw.clicks,
          "rageClick.clicks",
          DEFAULTS.rageClick.clicks,
        ),
        interval: readDuration(
          raw.interval,
          "rageClick.interval",
          DEFAULTS.rageClick.interval,
        ),
        radius: readDistance(
          raw.radius,
          "rageClick.radius",
          DEFAULTS.rageClick.radius,
        ),
      }),
    ),

    hesitation: readSection<HesitationOptions, ResolvedHesitationOptions>(
      options.hesitation,
      "hesitation",
      (raw) => ({
        threshold: readDuration(
          raw.threshold,
          "hesitation.threshold",
          DEFAULTS.hesitation.threshold,
        ),
      }),
    ),

    deadClick: readSection<DeadClickOptions, ResolvedDeadClickOptions>(
      options.deadClick,
      "deadClick",
      (raw) => ({
        timeout: readDuration(
          raw.timeout,
          "deadClick.timeout",
          DEFAULTS.deadClick.timeout,
        ),
        ignore: readSelector(raw.ignore, "deadClick.ignore"),
      }),
    ),
  };
}
