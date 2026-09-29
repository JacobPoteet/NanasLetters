import { useEffect, useRef, useState } from "react";
import type { Letter, Role } from "../../shared/types";
import { paragraphsWithHighlight } from "../../shared/letterHighlight";
import { meditationSearchUrl } from "../../shared/meditationSearchUrl";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

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
  const highlightRef = useRef<HTMLParagraphElement | null>(null);
  const highlight = new URLSearchParams(search).get("highlight");

  useDocumentTitle(pageTitle(data ? formatDate(data.letter.date) : null));

  useEffect(() => {
    setData(null);
    api
      .letter(id)
      .then(setData)
      .catch((err) => setError(err.message));
    trackVisit("letter", id);
  }, [id]);

  // Land the family member back on the exact spot they searched their way
  // to, once the letter (and the paragraph carrying it) has actually
  // rendered — see issue #20.
  useEffect(() => {
    if (!data || !highlight) return;
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data, highlight]);

  if (error) return <div className="content error-text">{error}</div>;
  if (!data) return <div className="content">Loading…</div>;

  const { letter, prevId, nextId } = data;
  const back = backToSearch(search);
  const paragraphs = paragraphsWithHighlight(letter.text, highlight);

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
        {paragraphs.map((p, i) =>
          p.highlightStart !== null && p.highlightEnd !== null ? (
            <p key={i} ref={highlightRef}>
              {p.text.slice(0, p.highlightStart)}
              <mark className="letter-highlight">{p.text.slice(p.highlightStart, p.highlightEnd)}</mark>
              {p.text.slice(p.highlightEnd)}
            </p>
          ) : (
            <p key={i}>{p.text}</p>
          ),
        )}
      </div>

      {letter.photos.length > 0 && (
        <div style={{ marginTop: 32 }}>
          {letter.photos.map((photo) => (
            <div key={photo.id}>
              <img
                className="letter-photo"
                src={`/api/photos/${photo.r2Key}`}
                alt={photo.caption ?? ""}
                loading="lazy"
              />
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
            <>
              <div className="meditation-note__title">{letter.meditationTitle}</div>
              <a
                href={meditationSearchUrl(letter.date)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: "var(--ink-faint)",
                }}
              >
                Search for it on cac.org →
              </a>
            </>
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
