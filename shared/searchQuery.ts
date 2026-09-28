// Pure fold for round-tripping the Search page's query/date-range state
// through the URL's query string. The state has to live in the URL, not
// just in SearchPage's local state, or leaving to read a letter and coming
// back (browser back button, or the letter view's own back link) lands on a
// blank search instead of the results the family member already had — see
// issue #17.

import type { SearchSort } from "./types";

const DEFAULT_SORT: SearchSort = "relevance";

export interface SearchQueryState {
  query: string;
  from: string | null;
  to: string | null;
  sort: SearchSort;
}

export function encodeSearchQuery({ query, from, to, sort }: SearchQueryState): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function decodeSearchQuery(search: string): SearchQueryState {
  const params = new URLSearchParams(search);
  const sortParam = params.get("sort");
  const sort: SearchSort = sortParam === "newest" || sortParam === "oldest" ? sortParam : DEFAULT_SORT;
  return { query: params.get("q") ?? "", from: params.get("from"), to: params.get("to"), sort };
}
