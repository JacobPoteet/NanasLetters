import { useState } from "react";
import type { SearchResult } from "../../shared/types";
import { api } from "../api";
import { Link } from "../router";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.search(query, from || undefined, to || undefined);
      setResults(r.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="content">
      <div className="eyebrow">Search</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        Find a letter
      </div>

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
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", fontSize: 13, color: "var(--ink-muted)" }}>
        <label>
          From{" "}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ marginLeft: 4 }} />
        </label>
        <label>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ marginLeft: 4 }} />
        </label>
      </div>

      {error && <div className="error-text" style={{ marginTop: 16 }}>{error}</div>}

      {results && (
        <div className="letter-list">
          {results.length === 0 ? (
            <div className="empty-state">No letters match.</div>
          ) : (
            results.map((result) => (
              <div className="letter-card" key={result.id}>
                <div className="letter-card__year">{result.date}</div>
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
