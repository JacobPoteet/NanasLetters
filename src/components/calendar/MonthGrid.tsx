// Pure layout: places a CalendarMonth's weeks into a 7-column grid and
// renders each cell via `renderDay`. Every visual decision (color, pips,
// click behavior) belongs to the caller — see AdminCalendar.tsx and
// CalendarPicker.tsx for the two completely different skins this same
// layout carries.

import type { ReactNode } from "react";
import type { CalendarDay, CalendarMonth } from "../../../shared/calendarGrid";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function MonthGrid({
  grid,
  renderDay,
  className,
  weekdayClassName,
}: {
  grid: CalendarMonth;
  renderDay: (day: CalendarDay | null) => ReactNode;
  className?: string;
  weekdayClassName?: string;
}) {
  return (
    <div className={className}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={weekdayClassName}
            style={weekdayClassName ? undefined : { fontSize: 10, color: "#999", textAlign: "center" }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {grid.weeks.map((week, i) =>
          week.map((day, j) => <div key={day?.date ?? `${i}-${j}`}>{renderDay(day)}</div>),
        )}
      </div>
    </div>
  );
}
