import { useEffect, useState } from "react";
import type { ArchiveStats, SearchResult, SearchSort } from "../../shared/types";
import { decodeSearchQuery, encodeSearchQuery } from "../../shared/searchQuery";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link, useRouter } from "../router";
import { CalendarPicker } from "../components/calendar/CalendarPicker";
import { useDocumentTitle } from "../useDocumentTitle";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatResultDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function SearchPage({ search }: { search: string }) {
  const { navigate } = useRouter();
  const initial = decodeSearchQuery(search);
  const [query, setQuery] = useState(initial.query);
  const [from, setFrom] = useState<string | null>(initial.from);
  const [to, setTo] = useState<string | null>(initial.to);
  const [sort, setSort] = useState<SearchSort>(initial.sort);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [stats, setStats] = useState<ArchiveStats | null>(null);

  useDocumentTitle(pageTitle("Search"));

  useEffect(() => {
    trackVisit("search");
    api.stats().then(setStats).catch(() => {});
  }, []);

  // The URL's query string is the source of truth for what's being searched,
  // so a browser back button (or the letter view's "back to search results"
  // link) landing back on /search with the same params reproduces the same
  // results instead of a blank page — see issue #17.
  useEffect(() => {
    const state = decodeSearchQuery(search);
    setQuery(state.query);
    setFrom(state.from);
    setTo(state.to);
    setSort(state.sort);
    setError(null);
    setHint(null);

    if (!state.query.trim() && !state.from && !state.to) {
      setResults(null);
      return;
    }

    api
      .search(state.query, state.from ?? undefined, state.to ?? undefined, state.sort)
      .then((r) => setResults(r.results))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"));
  }, [search]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!query.trim() && !from && !to) {
      setHint("Type a word or two, or choose a date range, to see letters here.");
      setResults(null);
      return;
    }

    navigate(`/search${encodeSearchQuery({ query, from, to, sort })}`, { replace: true });
  }

  function handleSortChange(nextSort: SearchSort) {
    setSort(nextSort);
    if (results !== null) {
      navigate(`/search${encodeSearchQuery({ query, from, to, sort: nextSort })}`, { replace: true });
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
          archiveStart={stats?.firstDate}
          archiveEnd={stats?.lastDate}
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
              <div className="search-result-bar">
                <div className="search-result-count">
                  {searchedByDateOnly
                    ? `${results.length} letter${results.length === 1 ? "" : "s"} in that range.`
                    : `${results.length} result${results.length === 1 ? "" : "s"}.`}
                </div>
                <label className="search-sort">
                  Sort by
                  <select
                    value={searchedByDateOnly && sort === "relevance" ? "newest" : sort}
                    onChange={(e) => handleSortChange(e.target.value as SearchSort)}
                  >
                    {!searchedByDateOnly && <option value="relevance">Best match</option>}
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>
              {results.map((result) => (
                <div className="letter-card reveal-on-scroll" key={result.id}>
                  <div className="letter-card__date">{formatResultDate(result.date)}</div>
                  <div className="letter-card__body">
                    <div
                      className="letter-card__excerpt search-result"
                      dangerouslySetInnerHTML={{ __html: result.snippetHtml }}
                    />
                    <Link
                      to={`/letters/${result.id}?${new URLSearchParams({
                        from: `/search${search}`,
                        ...(result.matchText ? { highlight: result.matchText } : {}),
                      })}`}
                      className="letter-card__link"
                    >
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
