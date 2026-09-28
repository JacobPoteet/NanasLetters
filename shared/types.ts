// Shared between worker/ and src/ so the API and the UI can't silently drift.

export type Role = "family" | "admin";

export interface Photo {
  id: number;
  letterId: number;
  r2Key: string;
  mimeType: string;
  caption: string | null;
}

export interface Letter {
  id: number;
  date: string; // YYYY-MM-DD
  text: string;
  meditationTitle: string | null;
  photos: Photo[];
}

/** A letter as it appears in a list (on-this-day, browse, search) — no full text. */
export interface LetterSummary {
  id: number;
  date: string;
  excerpt: string;
  hasPhoto: boolean;
}

export interface OnThisDayResult {
  /** The requested month/day, as this year's date (e.g. today). */
  monthDay: string; // MM-DD
  exact: LetterSummary[];
  /** Populated only when `exact` is empty — see the home-page fallback in CLAUDE.md. */
  nearby: LetterSummary[];
}

export interface SearchResult {
  id: number;
  date: string;
  /** FTS5 snippet() output — already contains <mark> around matched terms. */
  snippetHtml: string;
}

export type ReviewReason =
  | "no_forward_marker"
  | "unexpected_subject"
  | "ambiguous_duplicate";

export interface ReviewQueueItem {
  id: number;
  gmailMessageId: string;
  reason: ReviewReason;
  receivedDate: string;
  rawText: string;
  status: "pending" | "resolved" | "dismissed";
}
