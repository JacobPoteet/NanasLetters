// The real fix for the Search page's native <input type="date"> complaint:
// a browser's date-input popup is rendered by the OS and CSS cannot restyle
// it, so no cosmetic pass on the native input could ever match "Morning
// Paper" (CLAUDE.md's UI/layout section). This is a fully custom popover
// built on the same MonthGrid/buildMonthGrid the admin calendar (#3) uses —
// shared date math, completely different skin, since this one *is*
// family-facing and admin's utilitarian look is not the bar here.

import { useEffect, useRef, useState } from "react";
import { buildMonthGrid } from "../../../shared/calendarGrid";
import { MonthGrid } from "./MonthGrid";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS_PER_PAGE = 12;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export interface CalendarPickerProps {
  mode: "single" | "range";
  from: string | null;
  to: string | null;
  onChange: (range: { from: string | null; to: string | null }) => void;
  placeholder?: string;
  /** Moves the popover's view to this date without selecting it — lets a
   *  parent (e.g. Browse's year chips) point the calendar at a year/month
   *  it didn't itself pick a specific date for. */
  focusDate?: string | null;
  /** The archive's real span (from GET /api/stats). Days outside it are
   *  shown but disabled — there's never a letter to jump to before the
   *  first one or after the last — and the year-jump grid below is bounded
   *  to it instead of listing years nobody could ever pick. Defaults to a
   *  wide-open range so the picker still works before stats have loaded. */
  archiveStart?: string | null;
  archiveEnd?: string | null;
}

export function CalendarPicker({
  mode,
  from,
  to,
  onChange,
  placeholder,
  focusDate,
  archiveStart,
  archiveEnd,
}: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerView, setPickerView] = useState<"days" | "years">("days");
  const initial = focusDate ?? from ?? archiveEnd ?? todayIso();
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)));
  const [yearPageStart, setYearPageStart] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const bounds = {
    archiveStart: archiveStart ?? "1900-01-01",
    today: archiveEnd ?? todayIso(),
  };
  const minYear = Number(bounds.archiveStart.slice(0, 4));
  const maxYear = Number(bounds.today.slice(0, 4));
  // A single "month index" (year*12+month) bound, not just a year bound, so
  // stepping forward at the last real month (e.g. archiveEnd mid-year) stops
  // there instead of wrapping to January of a year that has no letters yet.
  const minMonthIndex = minYear * 12 + Number(bounds.archiveStart.slice(5, 7));
  const maxMonthIndex = maxYear * 12 + Number(bounds.today.slice(5, 7));
  const viewMonthIndex = viewYear * 12 + viewMonth;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) setPickerView("days");
  }, [open]);

  // A parent pointing the calendar at a year/month (Browse's year chips) or
  // an externally-set value (the URL driving Search's from/to on load)
  // should move the view even while the popover is closed, so it's already
  // showing the right place the next time it opens.
  useEffect(() => {
    const target = focusDate ?? from;
    if (!target) return;
    setViewYear(Number(target.slice(0, 4)));
    setViewMonth(Number(target.slice(5, 7)));
  }, [focusDate, from]);

  function goToMonthIndex(index: number) {
    const clamped = clamp(index, minMonthIndex, maxMonthIndex);
    setViewYear(Math.floor((clamped - 1) / 12));
    setViewMonth(((clamped - 1) % 12) + 1);
  }

  function changeMonth(delta: number) {
    goToMonthIndex(viewMonthIndex + delta);
  }

  function changeYear(delta: number) {
    goToMonthIndex(viewMonthIndex + delta * 12);
  }

  function openYearGrid() {
    const start = clamp(viewYear - Math.floor(YEARS_PER_PAGE / 2), minYear, Math.max(minYear, maxYear - YEARS_PER_PAGE + 1));
    setYearPageStart(start);
    setPickerView("years");
  }

  function handlePick(date: string) {
    if (mode === "single") {
      onChange({ from: date, to: null });
      setOpen(false);
      return;
    }
    if (!from || to) {
      onChange({ from: date, to: null });
    } else if (date < from) {
      onChange({ from: date, to: null });
    } else {
      onChange({ from, to: date });
    }
  }

  const grid = buildMonthGrid(viewYear, viewMonth, {}, bounds);
  const hasValue = mode === "single" ? Boolean(from) : Boolean(from || to);

  const label =
    mode === "single"
      ? (from ?? placeholder ?? "Pick a date")
      : from && to
        ? `${from} – ${to}`
        : from
          ? `${from} – …`
          : (placeholder ?? "Any date");

  const yearPageYears = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).filter(
    (y) => y >= minYear && y <= maxYear,
  );

  return (
    <div className="calendar-picker" ref={rootRef}>
      <span className="calendar-picker__trigger-row">
        <button type="button" className="calendar-picker__trigger" onClick={() => setOpen((o) => !o)}>
          {label}
        </button>
        {hasValue && (
          <button
            type="button"
            className="calendar-picker__clear"
            aria-label="Clear date"
            onClick={() => onChange({ from: null, to: null })}
          >
            ×
          </button>
        )}
      </span>
      {open && (
        <div className="calendar-picker__popover">
          {pickerView === "years" ? (
            <div className="calendar-picker__year-grid">
              <div className="calendar-picker__nav">
                <button
                  type="button"
                  disabled={yearPageStart <= minYear}
                  onClick={() => setYearPageStart((p) => clamp(p - YEARS_PER_PAGE, minYear, maxYear))}
                  aria-label="Earlier years"
                >
                  «
                </button>
                <span>
                  {yearPageYears[0]} – {yearPageYears[yearPageYears.length - 1]}
                </span>
                <button
                  type="button"
                  disabled={yearPageStart + YEARS_PER_PAGE > maxYear}
                  onClick={() => setYearPageStart((p) => clamp(p + YEARS_PER_PAGE, minYear, maxYear))}
                  aria-label="Later years"
                >
                  »
                </button>
              </div>
              <div className="calendar-picker__year-cells">
                {yearPageYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`calendar-picker__year-cell${y === viewYear ? " calendar-picker__year-cell--active" : ""}`}
                    onClick={() => {
                      setViewYear(y);
                      setPickerView("days");
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="calendar-picker__nav">
                <button type="button" onClick={() => changeYear(-1)} disabled={viewMonthIndex <= minMonthIndex} aria-label="Previous year">
                  «
                </button>
                <button type="button" onClick={() => changeMonth(-1)} disabled={viewMonthIndex <= minMonthIndex} aria-label="Previous month">
                  ‹
                </button>
                <button type="button" className="calendar-picker__nav-label" onClick={openYearGrid}>
                  {MONTH_NAMES[viewMonth - 1]} {viewYear}
                </button>
                <button type="button" onClick={() => changeMonth(1)} disabled={viewMonthIndex >= maxMonthIndex} aria-label="Next month">
                  ›
                </button>
                <button type="button" onClick={() => changeYear(1)} disabled={viewMonthIndex >= maxMonthIndex} aria-label="Next year">
                  »
                </button>
              </div>
              <MonthGrid
                grid={grid}
                renderDay={(day) => {
                  if (!day) return <div className="calendar-picker__cell calendar-picker__cell--empty" />;
                  const isFrom = day.date === from;
                  const isTo = day.date === to;
                  const inRange = mode === "range" && from && to && day.date > from && day.date < to;
                  const isToday = day.date === todayIso();
                  const disabled = day.state === "pre-archive" || day.state === "future";
                  const classes = ["calendar-picker__cell"];
                  if (isFrom || isTo) classes.push("calendar-picker__cell--selected");
                  else if (inRange) classes.push("calendar-picker__cell--in-range");
                  if (isToday) classes.push("calendar-picker__cell--today");
                  if (disabled) classes.push("calendar-picker__cell--disabled");
                  return (
                    <button
                      type="button"
                      className={classes.join(" ")}
                      disabled={disabled}
                      onClick={() => handlePick(day.date)}
                    >
                      {day.day}
                    </button>
                  );
                }}
              />
              {mode === "range" && (
                <div className="calendar-picker__footer">
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ from: null, to: null });
                    }}
                  >
                    Clear
                  </button>
                  <button type="button" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
