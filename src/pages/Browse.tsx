import { useEffect, useState } from "react";
import type { LetterSummary } from "../../shared/types";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";

export function BrowsePage() {
  const [letters, setLetters] = useState<LetterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div className="content error-text">{error}</div>;

  return (
    <div className="content">
      <div className="eyebrow">Browse</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        Every letter
      </div>
      <div className="subtext">Newest first.</div>

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
