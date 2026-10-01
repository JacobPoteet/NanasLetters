import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ArchiveStats, LetterSummary } from "../../shared/types";
import { groupLettersByYear } from "../../shared/groupLetters";
import { letterAtOrBefore } from "../../shared/letterAtOrBefore";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";
import { TimeScrubber } from "../components/TimeScrubber";
import { CalendarPicker } from "../components/calendar/CalendarPicker";
import { useDocumentTitle } from "../useDocumentTitle";

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

// The whole archive as light cards, kept across visits to this page. Coming
// back from a letter then renders the list synchronously — nothing to
// refetch and re-page before the reader's place can be restored.
let cachedLetters: LetterSummary[] | null = null;

// The reader's place is stored on the Browse history entry itself, not in
// component state or a global: Back from a letter returns to that exact
// entry (state intact, even across a refresh), while a fresh click on the
// Browse nav link is a new entry with no anchor and starts at the top.
function readAnchor(): number | null {
  const anchor = (window.history.state as { browseAnchor?: unknown } | null)?.browseAnchor;
  return typeof anchor === "number" ? anchor : null;
}

function rememberAnchor(letterId: number) {
  window.history.replaceState({ ...(window.history.state as object | null), browseAnchor: letterId }, "");
}

function scrollToLetter(id: number, block: ScrollLogicalPosition) {
  document.getElementById(`letter-${id}`)?.scrollIntoView({ block });
}

export function BrowsePage() {
  const [letters, setLetters] = useState<LetterSummary[] | null>(cachedLetters);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [returnedId, setReturnedId] = useState<number | null>(null);
  const restored = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useDocumentTitle(pageTitle("Browse"));

  useEffect(() => {
    api
      .browse({ limit: 10000 })
      .then((r) => {
        cachedLetters = r.letters;
        setLetters(r.letters);
      })
      .catch((err) => {
        if (!cachedLetters) setError(err.message);
      });
    api.stats().then(setStats).catch(() => {});
    trackVisit("browse");
  }, []);

  // Runs once, the first time cards exist: put the letter the reader just
  // came back from in the middle of the screen. Anchoring on the letter
  // (not a pixel offset) keeps this right if the layout or fonts shift.
  useLayoutEffect(() => {
    if (!letters || restored.current) return;
    restored.current = true;
    const anchor = readAnchor();
    if (anchor === null) return;
    scrollToLetter(anchor, "center");
    setReturnedId(anchor);
  }, [letters]);

  function handleJump(date: string | null) {
    setJumpDate(date);
    if (!letters) return;
    if (!date) {
      window.scrollTo({ top: 0 });
      return;
    }
    const target = letterAtOrBefore(letters, date);
    if (target) scrollToLetter(target.id, "start");
  }

  function handleYearJump(year: number) {
    setJumpDate(null);
    document.getElementById(`year-${year}`)?.scrollIntoView({ block: "start" });
  }

  if (error) return <div className="content error-text">{error}</div>;

  const groups = letters ? groupLettersByYear(letters) : [];

  return (
    <div className="content">
      <div className="eyebrow">Browse</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        Every letter
      </div>
      <div className="subtext">Newest first. Jump to a year or a date to skip ahead.</div>

      {stats && (
        <div className="browse-year-filter">
          {yearRange(stats).map((year) => (
            <button key={year} className="browse-year-filter__chip" onClick={() => handleYearJump(year)}>
              {year}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <CalendarPicker
          mode="single"
          from={jumpDate}
          to={null}
          onChange={(r) => handleJump(r.from)}
          placeholder="Jump to a date"
          archiveStart={stats?.firstDate}
          archiveEnd={stats?.lastDate}
        />
        {jumpDate && (
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
        <div className="letter-list letter-list--grouped" ref={listRef}>
          {groups.map((group) => (
            <div key={group.year}>
              <h2 className="browse-year-header" id={`year-${group.year}`}>
                {group.year}
              </h2>
              {group.months.map((month) => (
                <div key={month.month} data-month-key={`${group.year}-${String(month.month).padStart(2, "0")}`}>
                  <div className="browse-month-label">{MONTH_NAMES[month.month - 1]}</div>
                  {month.letters.map((letter) => (
                    <div
                      className={`letter-card reveal-on-scroll${letter.id === returnedId ? " letter-card--returned" : ""}`}
                      key={letter.id}
                      id={`letter-${letter.id}`}
                      onClickCapture={() => rememberAnchor(letter.id)}
                    >
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
      )}
      {letters && letters.length > 0 && <TimeScrubber listRef={listRef} contentKey={letters} />}
    </div>
  );
}
