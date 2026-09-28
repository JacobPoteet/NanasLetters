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
  /** A link to that day's meditation on cac.org, not its text — see CLAUDE.md. */
  meditationUrl: string | null;
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

/** "relevance" only means anything alongside a text query — see searchLetters in worker/db.ts. */
export type SearchSort = "relevance" | "newest" | "oldest";

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

export type AnalyticsPage = "home" | "browse" | "letter" | "search";

/** One day's visits/devices in the admin analytics trend chart. */
export interface AnalyticsDay {
  day: string; // YYYY-MM-DD
  visits: number;
  devices: number;
}

/** One row in the "most read" panel. */
export interface MostReadLetter {
  letterId: number;
  date: string;
  excerpt: string;
  reads: number;
}

/** The whole archive's shape in one payload — the admin calendar view (GitHub #3). */
export interface AdminCalendarSummary {
  archiveStart: string; // YYYY-MM-DD, MIN(date) across all letters
  today: string; // server's current date, so the client can tell a real gap from "hasn't happened yet"
  /** date -> letter ids on it. Usually 0 or 1 entries; a length >= 2 is a pip day. */
  lettersByDate: Record<string, number[]>;
  /** Dates with at least one pending review-queue item — the amber overlay. */
  pendingReviewDates: string[];
}

/** Family-facing archive totals for the homepage welcome line. */
export interface ArchiveStats {
  totalLetters: number;
  firstDate: string; // YYYY-MM-DD
  lastDate: string; // YYYY-MM-DD
  /** null only when the archive is genuinely empty — see Home's fallback. */
  firstLetterId: number | null;
}

/** Anonymous, operational-visibility-only usage summary (GitHub #8) — no per-person tracking. */
export interface AnalyticsSummary {
  windowDays: number;
  totalVisits: number;
  totalDevices: number;
  homeVisitsInWindow: number;
  newDevicesToday: number;
  /** Oldest first, one entry per day with any activity in the window. */
  daily: AnalyticsDay[];
  /** Most-read letters all time, most-read first. */
  mostRead: MostReadLetter[];
}
