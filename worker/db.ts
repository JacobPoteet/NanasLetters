import type {
  AdminCalendarSummary,
  AnalyticsDay,
  AnalyticsPage,
  AnalyticsSummary,
  ArchiveStats,
  Letter,
  LetterSummary,
  MostReadLetter,
  OnThisDayResult,
  Photo,
  ReviewQueueItem,
  SearchResult,
} from "../shared/types";
import { nearbyMonthDays } from "./dateWindow";
import { buildFtsQuery, escapeAndMarkSnippet, SNIPPET_MARK_END, SNIPPET_MARK_START } from "./search";

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
  options: { from?: string; to?: string; limit?: number } = {},
): Promise<SearchResult[]> {
  const ftsQuery = buildFtsQuery(query);

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

    const rows = await db
      .prepare(
        `SELECT id, date, text FROM letters WHERE ${conditions.join(" AND ")} ORDER BY date DESC, id DESC LIMIT ?${params.length}`,
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

  const rows = await db
    .prepare(
      `SELECT l.id, l.date, snippet(letters_fts, 0, ?${startIdx}, ?${endIdx}, '…', 12) AS snippet
       FROM letters_fts
       JOIN letters l ON l.id = letters_fts.rowid
       WHERE ${conditions.join(" AND ")}
       ORDER BY rank
       LIMIT ?${params.length}`,
    )
    .bind(...params)
    .all<SearchRow>();

  return (rows.results ?? []).map((r) => ({ id: r.id, date: r.date, snippetHtml: escapeAndMarkSnippet(r.snippet) }));
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
