import { useEffect, useState } from "react";
import type { Letter, Role } from "../../shared/types";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function formatWeekday(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

// Search results link here with ?from=/search?... (see SearchPage) so the
// letter view's back link returns to those exact results instead of always
// going to Home — see issue #17. Only ever a same-origin /search path is
// accepted, never an arbitrary redirect target.
function backToSearch(search: string): { to: string; label: string } | null {
  const from = new URLSearchParams(search).get("from");
  if (from && /^\/search(?:\?.*)?$/.test(from)) {
    return { to: from, label: "← Back to search results" };
  }
  return null;
}

export function LetterPage({ id, role, search }: { id: number; role: Role; search: string }) {
  const [data, setData] = useState<{ letter: Letter; prevId: number | null; nextId: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api
      .letter(id)
      .then(setData)
      .catch((err) => setError(err.message));
    trackVisit("letter", id);
  }, [id]);

  if (error) return <div className="content error-text">{error}</div>;
  if (!data) return <div className="content">Loading…</div>;

  const { letter, prevId, nextId } = data;
  const back = backToSearch(search);

  return (
    <div className="content content--narrow">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Link to={back?.to ?? "/"}>{back?.label ?? "← On this day"}</Link>
        {role === "admin" && <Link to={`/admin/letters/${id}`}>Edit</Link>}
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="eyebrow eyebrow--muted" style={{ letterSpacing: 0, textTransform: "none", fontWeight: 400 }}>
          {formatWeekday(letter.date)}
        </div>
        <div className="big-date" style={{ fontSize: 40 }}>
          {formatDate(letter.date)}
        </div>
      </div>

      <div className="letter-body">
        {letter.text.split("\n").map((paragraph, i) => (paragraph.trim() ? <p key={i}>{paragraph}</p> : null))}
      </div>

      {letter.photos.length > 0 && (
        <div style={{ marginTop: 32 }}>
          {letter.photos.map((photo) => (
            <div key={photo.id}>
              <div className="photo-placeholder photo-placeholder--large">photo placeholder</div>
              {photo.caption && (
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink-faint)", marginTop: 10 }}>
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {letter.meditationTitle && (
        <div className="meditation-note">
          <div className="eyebrow eyebrow--muted">That morning's meditation</div>
          {letter.meditationUrl ? (
            <a
              className="meditation-note__title"
              href={letter.meditationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block" }}
            >
              {letter.meditationTitle} — read it on cac.org →
            </a>
          ) : (
            <div className="meditation-note__title">{letter.meditationTitle}</div>
          )}
        </div>
      )}

      <div className="letter-nav">
        {prevId ? <Link to={`/letters/${prevId}`}>← Previous letter</Link> : <span />}
        {nextId ? <Link to={`/letters/${nextId}`}>Next letter →</Link> : <span />}
      </div>
    </div>
  );
}
