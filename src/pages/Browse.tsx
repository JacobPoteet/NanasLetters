import { useEffect, useState } from "react";
import type { LetterSummary } from "../../shared/types";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";
import { CalendarPicker } from "../components/calendar/CalendarPicker";

export function BrowsePage() {
  const [letters, setLetters] = useState<LetterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jumpDate, setJumpDate] = useState<string | null>(null);

  useEffect(() => {
    api
      .browse({})
      .then((r) => setLetters(r.letters))
      .catch((err) => setError(err.message));
    trackVisit("browse");
  }, []);

  async function loadMore() {
    if (!letters || letters.length === 0) return;
    const last = letters[letters.length - 1];
    const more = await api.browse({ before: { date: last.date, id: last.id } });
    setLetters([...letters, ...more.letters]);
  }

  async function handleJump(date: string | null) {
    setJumpDate(date);
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

  if (error) return <div className="content error-text">{error}</div>;

  return (
    <div className="content">
      <div className="eyebrow">Browse</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        Every letter
      </div>
      <div className="subtext">Newest first.</div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <CalendarPicker mode="single" from={jumpDate} to={null} onChange={(r) => handleJump(r.from)} placeholder="Jump to a date" />
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
        <>
          <div className="letter-list">
            {letters.map((letter) => (
              <div className="letter-card" key={letter.id}>
                <div className="letter-card__year">{letter.date}</div>
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
