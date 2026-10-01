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
