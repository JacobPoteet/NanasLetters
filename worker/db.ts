import type { Letter, LetterSummary, OnThisDayResult, Photo, ReviewQueueItem, SearchResult } from "../shared/types";
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

export async function getLetterById(db: D1Database, id: number): Promise<Letter | null> {
  const row = await db
    .prepare("SELECT id, date, text, meditation_title FROM letters WHERE id = ?1")
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

  return { id: row.id, date: row.date, text: row.text, meditationTitle: row.meditation_title, photos };
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
  if (!ftsQuery) return [];

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
  letter: { gmailMessageId: string; date: string; text: string; meditationTitle: string | null },
): Promise<number> {
  const result = await db
    .prepare("INSERT INTO letters (date, text, meditation_title, gmail_message_id) VALUES (?1, ?2, ?3, ?4)")
    .bind(letter.date, letter.text, letter.meditationTitle, letter.gmailMessageId)
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
  fields: { date?: string; text?: string; meditationTitle?: string | null },
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
  if (sets.length === 0) return;
  params.push(id);
  await db
    .prepare(`UPDATE letters SET ${sets.join(", ")} WHERE id = ?${params.length}`)
    .bind(...params)
    .run();
}

export async function resolveReviewItem(db: D1Database, id: number, status: "resolved" | "dismissed"): Promise<void> {
  await db.prepare("UPDATE review_queue SET status = ?1 WHERE id = ?2").bind(status, id).run();
}
