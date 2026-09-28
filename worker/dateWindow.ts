// Powers the "on this day" home page fallback: when nothing matches today's
// exact month/day across the years, show letters from a few days either side
// instead of an empty page (see CLAUDE.md's Functionality section).

/**
 * The MM-DD strings within `windowDays` of `monthDay`, nearest first, wrapping
 * correctly around month and year boundaries (Dec 30 -> Jan 2, Feb 28/29).
 * Uses a fixed leap year internally so Feb 29 arithmetic never throws.
 */
export function nearbyMonthDays(monthDay: string, windowDays: number): string[] {
  const [mm, dd] = monthDay.split("-").map(Number);
  const base = Date.UTC(2024, mm - 1, dd);
  const offsets: number[] = [];
  for (let i = 1; i <= windowDays; i++) offsets.push(-i, i);

  return offsets.map((offset) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${month}-${day}`;
  });
}

/** Today's date in the server's clock, as MM-DD. */
export function todayMonthDay(now: Date = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${month}-${day}`;
}

/** A full YYYY-MM-DD date shifted by `days` (negative goes backward), for the ingestion cursor's overlap window. */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
