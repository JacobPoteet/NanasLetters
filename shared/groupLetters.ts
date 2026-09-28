// Pure fold turning a flat, date-sorted letter list (browseLetters' shape)
// into the "year -> month" grouping CLAUDE.md's Browse spec calls for.
// Client-side, not a query change: Browse still paginates the same flat
// cursor from the API, and re-groups whatever it has loaded so far — a year
// can legitimately continue across a "load more" page boundary.

import type { LetterSummary } from "./types";

export interface MonthGroup {
  month: number; // 1-12
  letters: LetterSummary[];
}

export interface YearGroup {
  year: number;
  months: MonthGroup[];
}

/** Assumes `letters` is already sorted newest-first, as every Browse response is. */
export function groupLettersByYear(letters: LetterSummary[]): YearGroup[] {
  const years = new Map<number, Map<number, LetterSummary[]>>();

  for (const letter of letters) {
    const year = Number(letter.date.slice(0, 4));
    const month = Number(letter.date.slice(5, 7));
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(letter);
  }

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, monthLetters]) => ({ month, letters: monthLetters })),
    }));
}
