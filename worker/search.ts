// Turns a free-typed search box query into a safe SQLite FTS5 MATCH
// expression. FTS5's query syntax treats characters like " ( ) * - : as
// operators, so passing a person's raw typing straight into MATCH throws a
// syntax error on punctuation nobody meant as a query operator (an apostrophe
// in "don't", a dash in a date someone pastes in). Instead, pull out the
// alphanumeric words and AND them together — the common case (multi-word,
// all-terms-must-match) works, and nothing a person types can break the query.

export function buildFtsQuery(raw: string): string | null {
  const words = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return null;
  return words.map((word) => `"${word}"`).join(" AND ");
}

// FTS5's snippet() wraps matches in whatever delimiter strings it's given,
// but does nothing to escape the surrounding text — it's a raw slice of a
// letter's own words. A literal "<" she ever typed (an email address, "<3")
// would otherwise land unescaped in a dangerouslySetInnerHTML on the client.
// So snippet() is called with control characters as delimiters (bound as
// params in db.ts, never valid letter content), and only THIS function turns
// the result into real HTML: escape everything, then turn the delimiters —
// and only the delimiters — into <mark>/</mark>.
export const SNIPPET_MARK_START = "\u0001";
export const SNIPPET_MARK_END = "\u0002";

export function escapeAndMarkSnippet(raw: string): string {
  const escaped = raw.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped.replaceAll(SNIPPET_MARK_START, "<mark>").replaceAll(SNIPPET_MARK_END, "</mark>");
}
