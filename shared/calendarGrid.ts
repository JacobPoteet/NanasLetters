// Pure month-grid builder shared by the admin calendar (#3) and the
// family-facing CalendarPicker (Search/Browse) — one date-math fold, two
// completely different skins. See CLAUDE.md's UI/layout design-bar split:
// admin is exempt from it, the picker is not, so only the *rendering* of a
// CalendarDay differs between them, never this.

export type DayState = "empty" | "has-letters" | "pre-archive" | "future";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number; // 1-31
  count: number;
  state: DayState;
}

export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  /** Sun-Sat weeks, each exactly 7 cells; `null` fills days outside the month. */
  weeks: (CalendarDay | null)[][];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * A day with zero letters only counts as a real gap (`empty`) when it falls
 * inside the archive's actual span — before `archiveStart` there was nothing
 * to send yet (same rule the on-this-day fallback in worker/dateWindow.ts
 * follows for "not guaranteed before Feb 2018"), and after `today` the day
 * simply hasn't happened, which is not the same claim as a gap.
 */
function stateFor(date: string, count: number, archiveStart: string, today: string): DayState {
  if (count > 0) return "has-letters";
  if (date < archiveStart) return "pre-archive";
  if (date > today) return "future";
  return "empty";
}

/**
 * One calendar month, Sunday-first, as a grid ready to render. `lettersByDate`
 * maps a date to the letter ids on it (usually 0 or 1 entries, occasionally
 * more) — only the count feeds the grid; a consumer that needs the ids looks
 * them up from the same map it already has, keeping this fold decoupled from
 * click behavior.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  lettersByDate: Record<string, number[]>,
  options: { archiveStart: string; today: string },
): CalendarMonth {
  const { archiveStart, today } = options;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const cells: (CalendarDay | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad2(month)}-${pad2(d)}`;
    const count = (lettersByDate[date] ?? []).length;
    cells.push({ date, day: d, count, state: stateFor(date, count, archiveStart, today) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, weeks };
}
