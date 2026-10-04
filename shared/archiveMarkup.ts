// Small markup helpers shared by the archive's HTML, EPUB and PDF builders.
// Output has to be valid XML (EPUB content is XHTML), so escaping is stricter
// than plain HTML needs and control characters XML forbids are dropped.

// Control characters XML 1.0 forbids (everything below 0x20 except tab, LF, CR).
function isXmlForbidden(code: number): boolean {
  return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/./gs, (c) => (isXmlForbidden(c.charCodeAt(0)) ? "" : c))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A letter's body as one <p> per non-empty line — Nana writes in short lines, not wrapped paragraphs. */
export function paragraphsHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface YearGroup<T> {
  year: number;
  months: { month: number; letters: T[] }[];
}

/** Letters (already sorted oldest first) -> year -> month groups, skipping empty months. */
export function groupByYearMonth<T extends { date: string }>(letters: T[]): YearGroup<T>[] {
  const years: YearGroup<T>[] = [];
  for (const letter of letters) {
    const year = Number(letter.date.slice(0, 4));
    const month = Number(letter.date.slice(5, 7));
    let y = years[years.length - 1];
    if (!y || y.year !== year) {
      y = { year, months: [] };
      years.push(y);
    }
    let m = y.months[y.months.length - 1];
    if (!m || m.month !== month) {
      m = { month, letters: [] };
      y.months.push(m);
    }
    m.letters.push(letter);
  }
  return years;
}
