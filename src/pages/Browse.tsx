import { useEffect, useState } from "react";
import type { ArchiveStats, LetterSummary } from "../../shared/types";
import { groupLettersByYear } from "../../shared/groupLetters";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";
import { CalendarPicker } from "../components/calendar/CalendarPicker";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatShortDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}`;
}

function yearRange(stats: ArchiveStats): number[] {
  const first = Number(stats.firstDate.slice(0, 4));
  const last = Number(stats.lastDate.slice(0, 4));
  const years: number[] = [];
  for (let y = last; y >= first; y--) years.push(y);
  return years;
}

export function BrowsePage() {
  const [letters, setLetters] = useState<LetterSummary[] | null>(null);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    api
      .browse({})
      .then((r) => setLetters(r.letters))
      .catch((err) => setError(err.message));
    api.stats().then(setStats).catch(() => {});
    trackVisit("browse");
  }, []);

  async function loadMore() {
    if (!letters || letters.length === 0) return;
    const last = letters[letters.length - 1];
    const more = await api.browse({ year: selectedYear ?? undefined, before: { date: last.date, id: last.id } });
    setLetters([...letters, ...more.letters]);
  }

  async function handleJump(date: string | null) {
    setJumpDate(date);
    setSelectedYear(null);
    setLetters(null);
    setError(null);
    try {
      // A huge id on the picked date pulls in that whole date too, via
      // browseLetters' `date = ? AND id < ?` branch (worker/db.ts) — this
      // is the same cursor the "load more" pagination above uses, just
      // seeded at an arbitrary date instead of continuing from the list.
      const r = await api.browse(date ? { before: { date, id: Number.MAX_SAFE_INTEGER } } : {});
      setLetters(r.letters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleYearFilter(year: number | null) {
    setSelectedYear(year);
    setJumpDate(null);
    setLetters(null);
    setError(null);
    try {
      const r = await api.browse({ year: year ?? undefined });
      setLetters(r.letters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (error) return <div className="content error-text">{error}</div>;

  const groups = letters ? groupLettersByYear(letters) : [];

  return (
    <div className="content">
      <div className="eyebrow">Browse</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        Every letter
      </div>
      <div className="subtext">Newest first.</div>

      {stats && (
        <div className="browse-year-filter">
          <button
            className={`browse-year-filter__chip${selectedYear === null ? " browse-year-filter__chip--active" : ""}`}
            onClick={() => handleYearFilter(null)}
          >
            All years
          </button>
          {yearRange(stats).map((year) => (
            <button
              key={year}
              className={`browse-year-filter__chip${selectedYear === year ? " browse-year-filter__chip--active" : ""}`}
              onClick={() => handleYearFilter(year)}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <CalendarPicker mode="single" from={jumpDate} to={null} onChange={(r) => handleJump(r.from)} placeholder="Jump to a date" />
        {(jumpDate || selectedYear !== null) && (
          <button
            onClick={() => handleJump(null)}
            className="letter-card__link"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            Back to latest
          </button>
        )}
      </div>

      {!letters ? (
        <div className="empty-state">Loading…</div>
      ) : letters.length === 0 ? (
        <div className="empty-state">Nothing here yet.</div>
      ) : (
        <>
          <div className="letter-list letter-list--grouped">
            {groups.map((group) => (
              <div key={group.year}>
                <h2 className="browse-year-header">{group.year}</h2>
                {group.months.map((month) => (
                  <div key={month.month}>
                    <div className="browse-month-label">{MONTH_NAMES[month.month - 1]}</div>
                    {month.letters.map((letter) => (
                      <div className="letter-card reveal-on-scroll" key={letter.id}>
                        <div className="letter-card__date">{formatShortDate(letter.date)}</div>
                        <div className="letter-card__body">
                          <div className="letter-card__excerpt">"{letter.excerpt}"</div>
                          <Link to={`/letters/${letter.id}`} className="letter-card__link">
                            Read the letter →
                          </Link>
                        </div>
                        {letter.hasPhoto && <div className="photo-placeholder">photo</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <button onClick={loadMore} className="letter-card__link" style={{ background: "none", border: "none", cursor: "pointer" }}>
              Show more →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
