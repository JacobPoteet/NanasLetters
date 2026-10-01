// Pure folds behind Browse's time scrubber rail. Everything is expressed as a
// 0-1 fraction of the list's height (top = newest), so the rail maps straight
// onto the page's scroll space and stays correct however tall each card is.

export interface ScrubberTick {
  /** "YYYY-MM", matches the month's data-month-key in the list. */
  key: string;
  year: number;
  month: number;
  /** Where this month starts, as a fraction of the list's height. */
  fraction: number;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** The month a fraction falls in: the last tick starting at or above it. Assumes `ticks` ascend by fraction. */
export function tickAtFraction(ticks: ScrubberTick[], fraction: number): ScrubberTick | null {
  if (ticks.length === 0) return null;
  let found = ticks[0];
  for (const tick of ticks) {
    if (tick.fraction <= fraction) found = tick;
    else break;
  }
  return found;
}

/** Where the reader is, as a list fraction: a point a quarter of the way down the viewport, which is where their eye is. */
export function listFractionAtScroll(scrollY: number, viewportHeight: number, listTop: number, listHeight: number): number {
  if (listHeight <= 0) return 0;
  return clamp01((scrollY + viewportHeight * 0.25 - listTop) / listHeight);
}

/** A pointer's position on the rail, as a fraction of the rail's height. */
export function pointerFraction(clientY: number, railTop: number, railHeight: number): number {
  if (railHeight <= 0) return 0;
  return clamp01((clientY - railTop) / railHeight);
}

/** The month one step toward newer (-1) or older (+1) than `key`, clamped at the ends. */
export function adjacentTick(ticks: ScrubberTick[], key: string | null, step: -1 | 1): ScrubberTick | null {
  if (ticks.length === 0) return null;
  const i = ticks.findIndex((t) => t.key === key);
  if (i === -1) return ticks[0];
  return ticks[Math.min(ticks.length - 1, Math.max(0, i + step))];
}

/** Sarkar-Brown fisheye on one side of the focus: t in 0-1 is distance toward the edge, magnified near 0. */
function stretch(t: number, d: number): number {
  return ((d + 1) * t) / (d * t + 1);
}

function unstretch(u: number, d: number): number {
  return u / (d + 1 - d * u);
}

/**
 * Where a rail position (px from the rail's top) is drawn while the rail is
 * magnified around `focus`. The ends stay pinned, so the whole timeline remains
 * visible and monotone; only the spacing near the pointer opens up. `d` is the
 * magnification at the focus minus one; 0 is the identity.
 */
export function fisheye(x: number, focus: number, length: number, d: number): number {
  if (d <= 0 || length <= 0) return x;
  if (x >= focus) {
    const span = length - focus;
    return span <= 0 ? x : focus + span * stretch((x - focus) / span, d);
  }
  return focus <= 0 ? x : focus - focus * stretch((focus - x) / focus, d);
}

/** The rail position drawn at `y` under the same magnification: what the pointer is actually pointing at. */
export function inverseFisheye(y: number, focus: number, length: number, d: number): number {
  if (d <= 0 || length <= 0) return y;
  if (y >= focus) {
    const span = length - focus;
    return span <= 0 ? y : focus + span * unstretch((y - focus) / span, d);
  }
  return focus <= 0 ? y : focus - focus * unstretch((focus - y) / focus, d);
}
