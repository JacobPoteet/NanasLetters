import { useEffect, useState } from "react";
import type { SearchResult } from "../../shared/types";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";
import { CalendarPicker } from "../components/calendar/CalendarPicker";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    trackVisit("search");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHint(null);

    if (!query.trim() && !from && !to) {
      setHint("Type a word or two, or choose a date range, to see letters here.");
      setResults(null);
      return;
    }

    try {
      const r = await api.search(query, from ?? undefined, to ?? undefined);
      setResults(r.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const searchedByDateOnly = !query.trim() && (Boolean(from) || Boolean(to));

  return (
    <div className="content">
      <div className="eyebrow">Search</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        Find a letter
      </div>
      <div className="subtext">By word, by date range, or both.</div>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder="Search the letters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit">Search</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <CalendarPicker
          mode="range"
          from={from}
          to={to}
          onChange={(r) => {
            setFrom(r.from);
            setTo(r.to);
          }}
          placeholder="Any date"
        />
      </div>

      {error && <div className="error-text" style={{ marginTop: 16 }}>{error}</div>}
      {hint && <div className="empty-state">{hint}</div>}

      {results && (
        <div className="letter-list">
          {results.length === 0 ? (
            <div className="empty-state">
              No letters match. <Link to="/browse">Browse chronologically instead →</Link>
            </div>
          ) : (
            <>
              <div className="search-result-count">
                {searchedByDateOnly
                  ? `${results.length} letter${results.length === 1 ? "" : "s"} in that range.`
                  : `${results.length} result${results.length === 1 ? "" : "s"}.`}
              </div>
              {results.map((result) => (
                <div className="letter-card reveal-on-scroll" key={result.id}>
                  <div className="letter-card__year">{result.date.slice(0, 4)}</div>
                  <div className="letter-card__body">
                    <div
                      className="letter-card__excerpt search-result"
                      dangerouslySetInnerHTML={{ __html: result.snippetHtml }}
                    />
                    <Link to={`/letters/${result.id}`} className="letter-card__link">
                      Read the letter →
                    </Link>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
