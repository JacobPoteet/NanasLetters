// Admin's own browse/search: same /api/letters and /api/search endpoints the
// family-facing pages use, but every row links to the edit form instead of
// the read-only letter view. Exempt from the family-facing design bar.

import { useEffect, useState } from "react";
import type { LetterSummary, SearchResult } from "../../shared/types";
import { api } from "../api";
import { Link } from "../router";

export function AdminBrowsePage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [letters, setLetters] = useState<LetterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .browse({})
      .then((r) => setLetters(r.letters))
      .catch((err) => setError(err.message));
  }, []);

  async function loadMore() {
    if (!letters || letters.length === 0) return;
    const last = letters[letters.length - 1];
    const more = await api.browse({ before: { date: last.date, id: last.id } });
    setLetters([...letters, ...more.letters]);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (query.trim() === "") {
      setSearchResults(null);
      return;
    }
    try {
      const r = await api.search(query);
      setSearchResults(r.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="content" style={{ maxWidth: 900, fontFamily: "system-ui, sans-serif" }}>
      <h1>Browse &amp; edit letters</h1>

      <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search to find a letter to edit…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", maxWidth: 400, padding: 6 }}
        />
        <button type="submit" style={{ marginLeft: 8 }}>
          Search
        </button>
      </form>

      {error && <div className="error-text">{error}</div>}

      {searchResults ? (
        <>
          <p>
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for "{query}" —{" "}
            <button
              onClick={() => {
                setSearchResults(null);
                setQuery("");
              }}
            >
              Clear
            </button>
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {searchResults.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 8px 8px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{r.date}</td>
                  <td style={{ padding: 8 }} dangerouslySetInnerHTML={{ __html: r.snippetHtml }} />
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                    <Link to={`/admin/letters/${r.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : !letters ? (
        <p>Loading…</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {letters.map((letter) => (
                <tr key={letter.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 8px 8px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{letter.date}</td>
                  <td style={{ padding: 8 }}>{letter.excerpt}</td>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                    <Link to={`/admin/letters/${letter.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {letters.length > 0 && (
            <button onClick={loadMore} style={{ marginTop: 12 }}>
              Show more
            </button>
          )}
        </>
      )}
    </div>
  );
}
