// Search and "on this day" logic for the offline reader (scripts/archive/).
// Bundled into the reader's browser script by esbuild and unit-tested here, so
// the reader's one nontrivial behavior isn't verified only by eye.

export interface SearchableLetter {
  date: string; // YYYY-MM-DD
  text: string;
}

export interface SearchHit {
  index: number;
  before: string;
  match: string;
  after: string;
}

const SNIPPET_RADIUS = 70;

function tokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Every token must appear (substring, case-insensitive). The snippet is plain
 * strings, never HTML, so the reader can build it with textContent and a
 * letter containing a literal "<" can't break the page. With no query it's a
 * plain date-range read, mirroring the site's date-only search.
 */
export function searchLetters(
  letters: SearchableLetter[],
  opts: { query: string; from?: string; to?: string },
): SearchHit[] {
  const words = tokens(opts.query);
  const hits: SearchHit[] = [];
  letters.forEach((letter, index) => {
    if (opts.from && letter.date < opts.from) return;
    if (opts.to && letter.date > opts.to) return;
    if (words.length === 0) {
      hits.push({ index, before: "", match: "", after: letter.text.slice(0, SNIPPET_RADIUS * 2).trim() });
      return;
    }
    const lower = letter.text.toLowerCase();
    if (!words.every((w) => lower.includes(w))) return;
    const at = lower.indexOf(words[0]);
    const start = Math.max(0, at - SNIPPET_RADIUS);
    const end = Math.min(letter.text.length, at + words[0].length + SNIPPET_RADIUS);
    hits.push({
      index,
      before: (start > 0 ? "…" : "") + letter.text.slice(start, at),
      match: letter.text.slice(at, at + words[0].length),
      after: letter.text.slice(at + words[0].length, end) + (end < letter.text.length ? "…" : ""),
    });
  });
  return hits;
}

function dayOfYear(monthDay: string): number {
  const [m, d] = monthDay.split("-").map(Number);
  // 2001 is not a leap year; Feb 29 lands on Mar 1's slot, which is close enough for a "nearby" window.
  return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86400000);
}

function dayDistance(a: string, b: string): number {
  const diff = Math.abs(dayOfYear(a) - dayOfYear(b));
  return Math.min(diff, 365 - diff);
}

/**
 * Letters written on this month/day in any year, newest year first. When none
 * exist, the nearest days within `windowDays` instead (same fallback the live
 * site's home page has).
 */
export function onThisDay(
  letters: SearchableLetter[],
  monthDay: string,
  windowDays = 3,
): { exact: number[]; nearby: number[] } {
  const exact: number[] = [];
  const nearby: { index: number; distance: number }[] = [];
  letters.forEach((letter, index) => {
    const md = letter.date.slice(5);
    if (md === monthDay) exact.push(index);
    else {
      const distance = dayDistance(md, monthDay);
      if (distance <= windowDays) nearby.push({ index, distance });
    }
  });
  const newestFirst = (a: number, b: number) => letters[b].date.localeCompare(letters[a].date);
  exact.sort(newestFirst);
  if (exact.length > 0) return { exact, nearby: [] };
  nearby.sort((a, b) => a.distance - b.distance || newestFirst(a.index, b.index));
  return { exact, nearby: nearby.map((n) => n.index) };
}
