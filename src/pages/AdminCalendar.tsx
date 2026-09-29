// Year-at-a-glance archive health view (GitHub #3). Explicitly exempt from
// the family-facing design bar (CLAUDE.md) — plain and functional, same as
// every other /admin screen.

import { useEffect, useMemo, useState } from "react";
import type { AdminCalendarSummary, Letter } from "../../shared/types";
import type { CalendarDay } from "../../shared/calendarGrid";
import { buildMonthGrid } from "../../shared/calendarGrid";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { Link, useRouter } from "../router";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { useDocumentTitle } from "../useDocumentTitle";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function cellColor(day: CalendarDay): string {
  switch (day.state) {
    case "has-letters":
      return "#bfe3c0";
    case "empty":
      return "#f2b8b8";
    default:
      return "#eee"; // pre-archive / future
  }
}

export function AdminCalendarPage() {
  const { navigate } = useRouter();
  const [summary, setSummary] = useState<AdminCalendarSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedLetters, setExpandedLetters] = useState<Letter[] | null>(null);

  useDocumentTitle(pageTitle("Calendar"));

  useEffect(() => {
    api
      .calendarSummary()
      .then((s) => {
        setSummary(s);
        const dates = Object.keys(s.lettersByDate);
        const latest = dates.length > 0 ? dates.sort().at(-1)! : s.today;
        setYear(Number(latest.slice(0, 4)));
      })
      .catch((err) => setError(err.message));
  }, []);

  const pendingReviewSet = useMemo(
    () => new Set(summary?.pendingReviewDates ?? []),
    [summary],
  );

  async function handleDayClick(day: CalendarDay) {
    const ids = summary?.lettersByDate[day.date] ?? [];
    if (ids.length === 0) return;
    if (ids.length === 1) {
      navigate(`/admin/letters/${ids[0]}`);
      return;
    }
    if (expandedDate === day.date) {
      setExpandedDate(null);
      setExpandedLetters(null);
      return;
    }
    setExpandedDate(day.date);
    setExpandedLetters(null);
    const letters = await Promise.all(ids.map((id) => api.letter(id).then((r) => r.letter)));
    setExpandedLetters(letters);
  }

  if (error) return <div className="content error-text">{error}</div>;
  if (!summary || year === null) return <div className="content">Loading…</div>;

  return (
    <div className="content" style={{ maxWidth: 1000, fontFamily: "system-ui, sans-serif" }}>
      <h1>Calendar</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Archive starts {summary.archiveStart}. <span style={{ background: "#bfe3c0", padding: "0 6px" }}>Green</span> =
        has a letter, <span style={{ background: "#f2b8b8", padding: "0 6px" }}>red</span> = a real gap,{" "}
        <span style={{ border: "2px solid #d9a441", padding: "0 6px" }}>amber outline</span> = a pending review-queue
        item on that day.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
        <button onClick={() => setYear((y) => (y ?? 0) - 1)}>← {year! - 1}</button>
        <strong style={{ fontSize: 18 }}>{year}</strong>
        <button onClick={() => setYear((y) => (y ?? 0) + 1)}>{year! + 1} →</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        {MONTH_NAMES.map((name, i) => {
          const month = i + 1;
          const grid = buildMonthGrid(year, month, summary.lettersByDate, {
            archiveStart: summary.archiveStart,
            today: summary.today,
          });
          return (
            <div key={month}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{name}</div>
              <MonthGrid
                grid={grid}
                renderDay={(day) => {
                  if (!day) return <div style={{ height: 22 }} />;
                  const pending = pendingReviewSet.has(day.date);
                  const clickable = day.count > 0;
                  return (
                    <div
                      onClick={clickable ? () => handleDayClick(day) : undefined}
                      title={day.date}
                      style={{
                        height: 22,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        background: cellColor(day),
                        border: pending ? "2px solid #d9a441" : "1px solid #fff",
                        cursor: clickable ? "pointer" : "default",
                        position: "relative",
                      }}
                    >
                      {day.day}
                      {day.count >= 2 && (
                        <span style={{ position: "absolute", bottom: 0, right: 1, fontSize: 8 }}>{day.count}×</span>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          );
        })}
      </div>

      {expandedDate && (
        <div style={{ marginTop: 24, borderTop: "1px solid #ccc", paddingTop: 16 }}>
          <strong>Letters on {expandedDate}</strong>
          {!expandedLetters ? (
            <p>Loading…</p>
          ) : (
            <ul>
              {expandedLetters.map((letter) => (
                <li key={letter.id}>
                  <Link to={`/admin/letters/${letter.id}`}>
                    #{letter.id} — {letter.text.slice(0, 80)}…
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
