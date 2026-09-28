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

// buildMonthGrid's gap/pre-archive/future state is irrelevant here — this
// picker isn't showing letter counts, just plain dates — so these bounds are
// wide enough that every date in the picker's real, useful range (site
// lifetime) lands in whatever bucket, unused either way.
const IGNORED_BOUNDS = { archiveStart: "1900-01-01", today: "2999-12-31" };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface CalendarPickerProps {
  mode: "single" | "range";
  from: string | null;
  to: string | null;
  onChange: (range: { from: string | null; to: string | null }) => void;
  placeholder?: string;
}

export function CalendarPicker({ mode, from, to, onChange, placeholder }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const initial = from ?? todayIso();
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
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

  const grid = buildMonthGrid(viewYear, viewMonth, {}, IGNORED_BOUNDS);

  const label =
    mode === "single"
      ? (from ?? placeholder ?? "Pick a date")
      : from && to
        ? `${from} – ${to}`
        : from
          ? `${from} – …`
          : (placeholder ?? "Any date");

  return (
    <div className="calendar-picker" ref={rootRef}>
      <button type="button" className="calendar-picker__trigger" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div className="calendar-picker__popover">
          <div className="calendar-picker__nav">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
              ←
            </button>
            <span>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
              →
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
              const classes = ["calendar-picker__cell"];
              if (isFrom || isTo) classes.push("calendar-picker__cell--selected");
              else if (inRange) classes.push("calendar-picker__cell--in-range");
              if (isToday) classes.push("calendar-picker__cell--today");
              return (
                <button type="button" className={classes.join(" ")} onClick={() => handlePick(day.date)}>
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
        </div>
      )}
    </div>
  );
}
