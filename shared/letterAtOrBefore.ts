// Browse lists letters newest-first, so "jump to a date" means: the first
// letter on or before that date, i.e. where the reader would land scrolling
// down from the top. Falls back to the oldest letter when the date predates
// the whole archive, and null only for an empty list.

import type { LetterSummary } from "./types";

/** Assumes `letters` is sorted newest-first, as every Browse response is. */
export function letterAtOrBefore(letters: LetterSummary[], date: string): LetterSummary | null {
  if (letters.length === 0) return null;
  return letters.find((l) => l.date <= date) ?? letters[letters.length - 1];
}
