import type {
  AdminCalendarSummary,
  AdminComment,
  AnalyticsDay,
  AnalyticsPage,
  AnalyticsSummary,
  ArchiveStats,
  BannedDevice,
  Comment,
  CommentsAdminSummary,
  Letter,
  LetterSummary,
  MostReadLetter,
  OnThisDayResult,
  Photo,
  RecentComment,
  ReviewQueueItem,
  SearchResult,
  SearchSort,
} from "../shared/types";
import { nearbyMonthDays } from "./dateWindow";
import {
  buildFtsQuery,
  escapeAndMarkSnippet,
  plainSnippetText,
  SNIPPET_ELLIPSIS,
  SNIPPET_MARK_END,
  SNIPPET_MARK_START,
} from "./search";

interface LetterRow {
  id: number;
  date: string;
  text: string;
  meditation_title: string | null;
  has_photo: number;
}

interface LetterFullRow {
  id: number;
  date: string;
  text: string;
  meditation_title: string | null;
  meditation_url: string | null;
}

interface PhotoRow {
  id: number;
  letter_id: number;
  r2_key: string;
  mime_type: string;
  caption: string | null;
}

const EXCERPT_LENGTH = 160;

function excerptOf(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  return firstLine.length > EXCERPT_LENGTH ? `${firstLine.slice(0, EXCERPT_LENGTH).trimEnd()}…` : firstLine;
}

function rowToSummary(row: LetterRow): LetterSummary {
  return { id: row.id, date: row.date, excerpt: excerptOf(row.text), hasPhoto: row.has_photo === 1 };
}

const SUMMARY_SELECT = `
  SELECT l.id, l.date, l.text, l.meditation_title,
    EXISTS(SELECT 1 FROM letter_photos p WHERE p.letter_id = l.id) AS has_photo
  FROM letters l
`;

export async function getOnThisDay(db: D1Database, monthDay: string, nearbyWindowDays = 3): Promise<OnThisDayResult> {
  const exactRows = await db
    .prepare(`${SUMMARY_SELECT} WHERE substr(l.date, 6, 5) = ?1 ORDER BY l.date DESC`)
    .bind(monthDay)
    .all<LetterRow>();
  const exact = (exactRows.results ?? []).map(rowToSummary);

  if (exact.length > 0) return { monthDay, exact, nearby: [] };

  const candidates = nearbyMonthDays(monthDay, nearbyWindowDays);
  const placeholders = candidates.map((_, i) => `?${i + 1}`).join(", ");
  const nearbyRows = await db
    .prepare(`${SUMMARY_SELECT} WHERE substr(l.date, 6, 5) IN (${placeholders}) ORDER BY l.date DESC LIMIT 5`)
    .bind(...candidates)
    .all<LetterRow>();

  return { monthDay, exact: [], nearby: (nearbyRows.results ?? []).map(rowToSummary) };
}

/** Homepage welcome-section totals — same MIN(date) pattern as getCalendarSummary, minus its review-queue detail. */
export async function getArchiveStats(db: D1Database): Promise<ArchiveStats> {
  // Two queries, not one: SQLite's "bare column rides along with MIN()/MAX()"
  // trick only applies with a single aggregate in the query — this one has
  // both MIN and MAX, so which row `id` would come from is undefined. A
  // plain ORDER BY LIMIT 1 for the first letter's id is unambiguous.
  const [totals, first] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS total, MIN(date) AS firstDate, MAX(date) AS lastDate FROM letters")
      .first<{ total: number; firstDate: string | null; lastDate: string | null }>(),
    db.prepare("SELECT id FROM letters ORDER BY date ASC, id ASC LIMIT 1").first<{ id: number }>(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalLetters: totals?.total ?? 0,
    firstDate: totals?.firstDate ?? today,
    lastDate: totals?.lastDate ?? today,
    firstLetterId: first?.id ?? null,
  };
}

export async function getLetterById(db: D1Database, id: number): Promise<Letter | null> {
  const row = await db
    .prepare("SELECT id, date, text, meditation_title, meditation_url FROM letters WHERE id = ?1")
    .bind(id)
    .first<LetterFullRow>();
  if (!row) return null;

  const photoRows = await db
    .prepare("SELECT id, letter_id, r2_key, mime_type, caption FROM letter_photos WHERE letter_id = ?1")
    .bind(id)
    .all<PhotoRow>();
  const photos: Photo[] = (photoRows.results ?? []).map((p) => ({
    id: p.id,
    letterId: p.letter_id,
    r2Key: p.r2_key,
    mimeType: p.mime_type,
    caption: p.caption,
  }));

  return {
    id: row.id,
    date: row.date,
    text: row.text,
    meditationTitle: row.meditation_title,
    meditationUrl: row.meditation_url,
    photos,
  };
}

/** The letter immediately before or after this one by date, for the letter view's prev/next nav. */
export async function getAdjacentLetterId(db: D1Database, date: string, direction: "prev" | "next") {
  const comparison = direction === "prev" ? "<" : ">";
  const order = direction === "prev" ? "DESC" : "ASC";
  const row = await db
    .prepare(`SELECT id FROM letters WHERE date ${comparison} ?1 ORDER BY date ${order} LIMIT 1`)
    .bind(date)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function browseLetters(
  db: D1Database,
  options: { year?: number; month?: number; before?: { date: string; id: number }; limit?: number } = {},
): Promise<LetterSummary[]> {
  const { year, month, before, limit = 30 } = options;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (year !== undefined) {
    params.push(String(year));
    conditions.push(`substr(l.date, 1, 4) = ?${params.length}`);
  }
  if (month !== undefined) {
    params.push(String(month).padStart(2, "0"));
    conditions.push(`substr(l.date, 6, 2) = ?${params.length}`);
  }
  if (before !== undefined) {
    // Chronological order comes from `date`, but two letters can share a
    // date (a resend that wasn't an exact duplicate, say), so `id` breaks
    // the tie — this is why the cursor is a (date, id) pair, not just an id.
    params.push(before.date, before.date, before.id);
    conditions.push(`(l.date < ?${params.length - 2} OR (l.date = ?${params.length - 1} AND l.id < ?${params.length}))`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);
  const rows = await db
    .prepare(`${SUMMARY_SELECT} ${where} ORDER BY l.date DESC, l.id DESC LIMIT ?${params.length}`)
    .bind(...params)
    .all<LetterRow>();
  return (rows.results ?? []).map(rowToSummary);
}

interface SearchRow {
  id: number;
  date: string;
  snippet: string;
}

export async function searchLetters(
  db: D1Database,
  query: string,
  options: { from?: string; to?: string; limit?: number; sort?: SearchSort } = {},
): Promise<SearchResult[]> {
  const ftsQuery = buildFtsQuery(query);
  const sort = options.sort ?? "relevance";

  // No words typed: with no date filter either, there's nothing to search
  // for — but a date range alone is a real request ("everything from March
  // 2021"), so it falls back to a plain date-filtered read of `letters`
  // instead of dead-ending on FTS's empty-query behavior. escapeAndMarkSnippet
  // is safe to reuse here even though there's no match to mark — plain text
  // with no delimiter characters in it just comes back HTML-escaped.
  if (!ftsQuery) {
    if (!options.from && !options.to) return [];

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (options.from) {
      params.push(options.from);
      conditions.push(`date >= ?${params.length}`);
    }
    if (options.to) {
      params.push(options.to);
      conditions.push(`date <= ?${params.length}`);
    }
    params.push(options.limit ?? 20);

    // No FTS match to rank, so "relevance" falls back to newest-first here —
    // the same date-only read this whole branch already is.
    const order = sort === "oldest" ? "date ASC, id ASC" : "date DESC, id DESC";
    const rows = await db
      .prepare(
        `SELECT id, date, text FROM letters WHERE ${conditions.join(" AND ")} ORDER BY ${order} LIMIT ?${params.length}`,
      )
      .bind(...params)
      .all<{ id: number; date: string; text: string }>();

    return (rows.results ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      snippetHtml: escapeAndMarkSnippet(excerptOf(r.text)),
    }));
  }

  const conditions = ["letters_fts MATCH ?1"];
  // Bound params, not string literals: snippet()'s delimiters are control
  // characters that escapeAndMarkSnippet() below turns into real <mark>
  // tags — see the comment on that function for why raw HTML delimiters
  // would be a correctness bug, not just a style choice.
  const params: unknown[] = [ftsQuery];
  params.push(SNIPPET_MARK_START, SNIPPET_MARK_END);
  const startIdx = params.length - 1;
  const endIdx = params.length;

  if (options.from) {
    params.push(options.from);
    conditions.push(`l.date >= ?${params.length}`);
  }
  if (options.to) {
    params.push(options.to);
    conditions.push(`l.date <= ?${params.length}`);
  }
  params.push(options.limit ?? 20);

  const order = sort === "newest" ? "l.date DESC, l.id DESC" : sort === "oldest" ? "l.date ASC, l.id ASC" : "rank";
  const rows = await db
    .prepare(
      `SELECT l.id, l.date, snippet(letters_fts, 0, ?${startIdx}, ?${endIdx}, '${SNIPPET_ELLIPSIS}', 12) AS snippet
       FROM letters_fts
       JOIN letters l ON l.id = letters_fts.rowid
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${order}
       LIMIT ?${params.length}`,
    )
    .bind(...params)
    .all<SearchRow>();

  return (rows.results ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    snippetHtml: escapeAndMarkSnippet(r.snippet),
    // The plain, un-marked, un-truncated substring behind the highlighted
    // blurb — the letter view uses this to find and highlight the same spot
    // in the full letter text when opened from this result — see issue #20.
    matchText: plainSnippetText(r.snippet),
  }));
}

// --- Ingestion writes ---

export async function letterExists(db: D1Database, gmailMessageId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM letters WHERE gmail_message_id = ?1")
    .bind(gmailMessageId)
    .first();
  return row !== null;
}

/** For same-day duplicate detection during ingestion — see CLAUDE.md's parsing findings. */
export async function getLetterTextByDate(db: D1Database, date: string): Promise<string | null> {
  const row = await db.prepare("SELECT text FROM letters WHERE date = ?1").bind(date).first<{ text: string }>();
  return row?.text ?? null;
}

export async function insertLetter(
  db: D1Database,
  letter: {
    gmailMessageId: string;
    date: string;
    text: string;
    meditationTitle: string | null;
    meditationUrl: string | null;
  },
): Promise<number> {
  const result = await db
    .prepare(
      "INSERT INTO letters (date, text, meditation_title, meditation_url, gmail_message_id) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(letter.date, letter.text, letter.meditationTitle, letter.meditationUrl, letter.gmailMessageId)
    .run();
  return result.meta.last_row_id;
}

export async function insertReviewItem(
  db: D1Database,
  item: { gmailMessageId: string; reason: string; receivedDate: string; rawText: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO review_queue (gmail_message_id, reason, received_date, raw_text)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (gmail_message_id) DO NOTHING`,
    )
    .bind(item.gmailMessageId, item.reason, item.receivedDate, item.rawText)
    .run();
}

export async function getIngestionState(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM ingestion_state WHERE key = ?1").bind(key).first<{
    value: string;
  }>();
  return row?.value ?? null;
}

export async function setIngestionState(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare("INSERT INTO ingestion_state (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2")
    .bind(key, value)
    .run();
}

// --- Admin ---

export async function listReviewQueue(db: D1Database, status: string = "pending"): Promise<ReviewQueueItem[]> {
  const rows = await db
    .prepare(
      "SELECT id, gmail_message_id, reason, received_date, raw_text, status FROM review_queue WHERE status = ?1 ORDER BY received_date DESC",
    )
    .bind(status)
    .all<{
      id: number;
      gmail_message_id: string;
      reason: ReviewQueueItem["reason"];
      received_date: string;
      raw_text: string;
      status: ReviewQueueItem["status"];
    }>();
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    gmailMessageId: r.gmail_message_id,
    reason: r.reason,
    receivedDate: r.received_date,
    rawText: r.raw_text,
    status: r.status,
  }));
}

export async function updateLetter(
  db: D1Database,
  id: number,
  fields: { date?: string; text?: string; meditationTitle?: string | null; meditationUrl?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.date !== undefined) {
    params.push(fields.date);
    sets.push(`date = ?${params.length}`);
  }
  if (fields.text !== undefined) {
    params.push(fields.text);
    sets.push(`text = ?${params.length}`);
  }
  if (fields.meditationTitle !== undefined) {
    params.push(fields.meditationTitle);
    sets.push(`meditation_title = ?${params.length}`);
  }
  if (fields.meditationUrl !== undefined) {
    params.push(fields.meditationUrl);
    sets.push(`meditation_url = ?${params.length}`);
  }
  if (sets.length === 0) return;
  params.push(id);
  await db
    .prepare(`UPDATE letters SET ${sets.join(", ")} WHERE id = ?${params.length}`)
    .bind(...params)
    .run();
}

/**
 * Removes a letter (e.g. a same-day duplicate that should have been merged —
 * see CLAUDE.md's parsing findings). `letter_photos` cascades via the FK,
 * and `letters_fts` stays in sync via the `letters_ad` trigger (see
 * migrations/0001_init.sql) — nothing else needs to know about this delete.
 */
export async function deleteLetter(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM letters WHERE id = ?1").bind(id).run();
}

export async function getReviewItemById(db: D1Database, id: number): Promise<ReviewQueueItem | null> {
  const row = await db
    .prepare("SELECT id, gmail_message_id, reason, received_date, raw_text, status FROM review_queue WHERE id = ?1")
    .bind(id)
    .first<{
      id: number;
      gmail_message_id: string;
      reason: ReviewQueueItem["reason"];
      received_date: string;
      raw_text: string;
      status: ReviewQueueItem["status"];
    }>();
  if (!row) return null;
  return {
    id: row.id,
    gmailMessageId: row.gmail_message_id,
    reason: row.reason,
    receivedDate: row.received_date,
    rawText: row.raw_text,
    status: row.status,
  };
}

export async function dismissReviewItem(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE review_queue SET status = 'dismissed' WHERE id = ?1").bind(id).run();
}

/**
 * Turns a review-queue item into a real letter: inserts the corrected/edited
 * fields as a `letters` row and marks the queue item resolved, as one atomic
 * `batch()` — D1 has no cross-statement transactions, so without batch() a
 * failure between the two writes could insert the letter but leave the queue
 * item stuck pending (or the reverse), see CLAUDE.md's D1/FTS trigger note
 * for the same reasoning applied to a different pair of writes.
 */
export async function acceptReviewItem(
  db: D1Database,
  id: number,
  gmailMessageId: string,
  letter: { date: string; text: string; meditationTitle: string | null; meditationUrl: string | null },
): Promise<number> {
  const [insertResult] = await db.batch([
    db
      .prepare(
        "INSERT INTO letters (date, text, meditation_title, meditation_url, gmail_message_id) VALUES (?1, ?2, ?3, ?4, ?5)",
      )
      .bind(letter.date, letter.text, letter.meditationTitle, letter.meditationUrl, gmailMessageId),
    db.prepare("UPDATE review_queue SET status = 'resolved' WHERE id = ?1").bind(id),
  ]);
  return insertResult.meta.last_row_id;
}

// --- Analytics (GitHub #8) — anonymous, operational visibility only ---

export async function recordVisit(
  db: D1Database,
  visit: { deviceId: string; page: AnalyticsPage; letterId: number | null },
): Promise<void> {
  await db
    .prepare("INSERT INTO analytics_visits (visit_day, device_id, page, letter_id) VALUES (date('now'), ?1, ?2, ?3)")
    .bind(visit.deviceId, visit.page, visit.letterId)
    .run();
}

const ANALYTICS_WINDOW_DAYS = 30;

export async function getAnalyticsSummary(db: D1Database): Promise<AnalyticsSummary> {
  const [totals, homeInWindow, newToday, daily, mostReadRows] = await Promise.all([
    db.prepare("SELECT count(*) as visits, count(distinct device_id) as devices FROM analytics_visits").first<{
      visits: number;
      devices: number;
    }>(),
    db
      .prepare(
        `SELECT count(*) as c FROM analytics_visits
         WHERE page = 'home' AND visit_day >= date('now', ?1)`,
      )
      .bind(`-${ANALYTICS_WINDOW_DAYS} days`)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT count(*) as c FROM (
           SELECT device_id, min(visit_day) as first_day FROM analytics_visits GROUP BY device_id
         ) WHERE first_day = date('now')`,
      )
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT visit_day as day, count(*) as visits, count(distinct device_id) as devices
         FROM analytics_visits
         WHERE visit_day >= date('now', ?1)
         GROUP BY visit_day ORDER BY visit_day ASC`,
      )
      .bind(`-${ANALYTICS_WINDOW_DAYS} days`)
      .all<AnalyticsDay>(),
    db
      .prepare(
        `SELECT av.letter_id as letterId, l.date as date, l.text as text, count(*) as reads
         FROM analytics_visits av JOIN letters l ON l.id = av.letter_id
         WHERE av.page = 'letter'
         GROUP BY av.letter_id ORDER BY reads DESC LIMIT 10`,
      )
      .all<{ letterId: number; date: string; text: string; reads: number }>(),
  ]);

  const mostRead: MostReadLetter[] = (mostReadRows.results ?? []).map((r) => ({
    letterId: r.letterId,
    date: r.date,
    excerpt: excerptOf(r.text),
    reads: r.reads,
  }));

  return {
    windowDays: ANALYTICS_WINDOW_DAYS,
    totalVisits: totals?.visits ?? 0,
    totalDevices: totals?.devices ?? 0,
    homeVisitsInWindow: homeInWindow?.c ?? 0,
    newDevicesToday: newToday?.c ?? 0,
    daily: daily.results ?? [],
    mostRead,
  };
}

// --- Admin calendar (GitHub #3) ---

export async function getCalendarSummary(db: D1Database): Promise<AdminCalendarSummary> {
  const [letterRows, reviewRows, span] = await Promise.all([
    db.prepare("SELECT date, id FROM letters ORDER BY date").all<{ date: string; id: number }>(),
    db
      .prepare("SELECT DISTINCT received_date FROM review_queue WHERE status = 'pending'")
      .all<{ received_date: string }>(),
    db.prepare("SELECT min(date) as archiveStart FROM letters").first<{ archiveStart: string | null }>(),
  ]);

  const lettersByDate: Record<string, number[]> = {};
  for (const row of letterRows.results ?? []) {
    (lettersByDate[row.date] ??= []).push(row.id);
  }

  return {
    archiveStart: span?.archiveStart ?? new Date().toISOString().slice(0, 10),
    today: new Date().toISOString().slice(0, 10),
    lettersByDate,
    pendingReviewDates: (reviewRows.results ?? []).map((r) => r.received_date),
  };
}

// --- Settings (generic key/value flags, first used for comments) ---

export async function getCommentsRequireLogin(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'comments_require_login'")
    .first<{ value: string }>();
  return (row?.value ?? "true") === "true";
}

export async function setCommentsRequireLogin(db: D1Database, value: boolean): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('comments_require_login', ?1)
       ON CONFLICT (key) DO UPDATE SET value = ?1`,
    )
    .bind(value ? "true" : "false")
    .run();
}

// --- Comments ---

interface CommentRow {
  id: number;
  letter_id: number;
  author_name: string | null;
  body: string;
  created_at: string;
}

function rowToComment(row: CommentRow): Comment {
  return { id: row.id, letterId: row.letter_id, authorName: row.author_name, body: row.body, createdAt: row.created_at };
}

export async function getCommentsForLetter(db: D1Database, letterId: number): Promise<Comment[]> {
  const rows = await db
    .prepare(
      "SELECT id, letter_id, author_name, body, created_at FROM comments WHERE letter_id = ?1 AND status = 'visible' ORDER BY created_at ASC, id ASC",
    )
    .bind(letterId)
    .all<CommentRow>();
  return (rows.results ?? []).map(rowToComment);
}

export async function isDeviceBanned(db: D1Database, deviceId: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 FROM comment_bans WHERE device_id = ?1").bind(deviceId).first();
  return row !== null;
}

const COMMENT_RATE_LIMIT_WINDOW_SECONDS = 60;
const COMMENT_RATE_LIMIT_MAX = 5;

/** Cheap insurance against a burst of spam before an admin can reach the ban button — not a moderation strategy on its own. */
export async function isCommentRateLimited(db: D1Database, deviceId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT count(*) as c FROM comments WHERE device_id = ?1 AND created_at >= datetime('now', ?2)`)
    .bind(deviceId, `-${COMMENT_RATE_LIMIT_WINDOW_SECONDS} seconds`)
    .first<{ c: number }>();
  return (row?.c ?? 0) >= COMMENT_RATE_LIMIT_MAX;
}

export async function insertComment(
  db: D1Database,
  comment: { letterId: number; deviceId: string; ipHash: string | null; authorName: string | null; body: string },
): Promise<number> {
  const result = await db
    .prepare("INSERT INTO comments (letter_id, device_id, ip_hash, author_name, body) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(comment.letterId, comment.deviceId, comment.ipHash, comment.authorName, comment.body)
    .run();
  return result.meta.last_row_id;
}

const RECENT_COMMENTS_LIMIT = 8;

/** Homepage feed (Jacob's ask: promote a comment instead of letting it get lost on its own letter page). */
export async function getRecentComments(db: D1Database, limit = RECENT_COMMENTS_LIMIT): Promise<RecentComment[]> {
  const rows = await db
    .prepare(
      `SELECT c.id, c.letter_id, c.author_name, c.body, c.created_at, l.date as letter_date, l.text as letter_text
       FROM comments c JOIN letters l ON l.id = c.letter_id
       WHERE c.status = 'visible'
       ORDER BY c.created_at DESC, c.id DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<CommentRow & { letter_date: string; letter_text: string }>();
  return (rows.results ?? []).map((r) => ({
    ...rowToComment(r),
    letterDate: r.letter_date,
    letterExcerpt: excerptOf(r.letter_text),
  }));
}

// --- Admin: comments moderation (Jacob's ask: delete a comment, ban a
// device, or wipe everything from a device, without a pre-moderation queue) ---

export async function listCommentsForAdmin(
  db: D1Database,
  filters: { letterId?: number; deviceId?: string; includeDeleted?: boolean } = {},
): Promise<AdminComment[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.letterId !== undefined) {
    params.push(filters.letterId);
    conditions.push(`c.letter_id = ?${params.length}`);
  }
  if (filters.deviceId !== undefined) {
    params.push(filters.deviceId);
    conditions.push(`c.device_id = ?${params.length}`);
  }
  if (!filters.includeDeleted) conditions.push(`c.status = 'visible'`);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await db
    .prepare(
      `SELECT c.id, c.letter_id, c.author_name, c.body, c.created_at, c.device_id, c.ip_hash, c.status,
         l.date as letter_date,
         EXISTS(SELECT 1 FROM comment_bans b WHERE b.device_id = c.device_id) as banned
       FROM comments c JOIN letters l ON l.id = c.letter_id
       ${where}
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .bind(...params)
    .all<
      CommentRow & {
        device_id: string;
        ip_hash: string | null;
        status: "visible" | "deleted";
        letter_date: string;
        banned: number;
      }
    >();

  return (rows.results ?? []).map((r) => ({
    ...rowToComment(r),
    deviceId: r.device_id,
    ipHash: r.ip_hash,
    status: r.status,
    letterDate: r.letter_date,
    bannedDevice: r.banned === 1,
  }));
}

export async function deleteComment(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE comments SET status = 'deleted' WHERE id = ?1").bind(id).run();
}

export async function deleteCommentsByDevice(db: D1Database, deviceId: string): Promise<void> {
  await db.prepare("UPDATE comments SET status = 'deleted' WHERE device_id = ?1").bind(deviceId).run();
}

export async function banDevice(db: D1Database, deviceId: string, reason: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO comment_bans (device_id, reason) VALUES (?1, ?2)
       ON CONFLICT (device_id) DO UPDATE SET reason = ?2`,
    )
    .bind(deviceId, reason)
    .run();
}

export async function unbanDevice(db: D1Database, deviceId: string): Promise<void> {
  await db.prepare("DELETE FROM comment_bans WHERE device_id = ?1").bind(deviceId).run();
}

export async function listBannedDevices(db: D1Database): Promise<BannedDevice[]> {
  const rows = await db
    .prepare(
      `SELECT b.device_id, b.reason, b.banned_at, count(c.id) as comment_count
       FROM comment_bans b LEFT JOIN comments c ON c.device_id = b.device_id
       GROUP BY b.device_id ORDER BY b.banned_at DESC`,
    )
    .all<{ device_id: string; reason: string | null; banned_at: string; comment_count: number }>();
  return (rows.results ?? []).map((r) => ({
    deviceId: r.device_id,
    reason: r.reason,
    bannedAt: r.banned_at,
    commentCount: r.comment_count,
  }));
}

export async function getCommentsAdminSummary(db: D1Database): Promise<CommentsAdminSummary> {
  const [totals, today, week, banned] = await Promise.all([
    db
      .prepare("SELECT count(*) as c, count(distinct device_id) as devices FROM comments WHERE status = 'visible'")
      .first<{ c: number; devices: number }>(),
    db
      .prepare("SELECT count(*) as c FROM comments WHERE status = 'visible' AND date(created_at) = date('now')")
      .first<{ c: number }>(),
    db
      .prepare("SELECT count(*) as c FROM comments WHERE status = 'visible' AND created_at >= datetime('now', '-7 days')")
      .first<{ c: number }>(),
    db.prepare("SELECT count(*) as c FROM comment_bans").first<{ c: number }>(),
  ]);
  return {
    totalComments: totals?.c ?? 0,
    uniqueDevices: totals?.devices ?? 0,
    commentsToday: today?.c ?? 0,
    commentsThisWeek: week?.c ?? 0,
    bannedDevices: banned?.c ?? 0,
  };
}
