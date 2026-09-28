-- Nana's Letters — initial schema
--
-- Migrations here are additive only, forever (see CLAUDE.md's "The prod
-- database is the only copy that matters") — never a later migration that
-- drops or rewrites a column holding letter content without a verified
-- export first.

CREATE TABLE letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  text TEXT NOT NULL,
  meditation_title TEXT,
  -- Idempotency key for ingestion: re-running backfill over the same Gmail
  -- history must never duplicate a letter.
  gmail_message_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_letters_date ON letters(date);
-- Backs the "on this day" query (WHERE substr(date, 6, 5) = '09-27').
CREATE INDEX idx_letters_month_day ON letters(substr(date, 6, 5));

CREATE TABLE letter_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  letter_id INTEGER NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  caption TEXT
);

CREATE INDEX idx_letter_photos_letter ON letter_photos(letter_id);

-- Anything the ingestion parser wasn't confident about (no recognized forward
-- marker, an unexpected subject shape, an ambiguous same-day duplicate) lands
-- here instead of writing a wrong or duplicated row into `letters`. See the
-- admin edit screen in CLAUDE.md's Functionality section.
CREATE TABLE review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK (reason IN ('no_forward_marker', 'unexpected_subject', 'ambiguous_duplicate')),
  received_date TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Small key/value table for ingestion bookkeeping (e.g. the newest Gmail
-- internalDate already processed), so a cron run only looks at what's new.
CREATE TABLE ingestion_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full-text search over letters.text, kept in sync via triggers rather than
-- application-level writes: D1 doesn't support cross-statement transactions,
-- but a SQLite trigger fires inside the same statement as the write on
-- `letters`, so the FTS index can never drift out of sync with a partial write.
CREATE VIRTUAL TABLE letters_fts USING fts5(
  text,
  content = 'letters',
  content_rowid = 'id'
);

CREATE TRIGGER letters_ai AFTER INSERT ON letters BEGIN
  INSERT INTO letters_fts (rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER letters_ad AFTER DELETE ON letters BEGIN
  INSERT INTO letters_fts (letters_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;

CREATE TRIGGER letters_au AFTER UPDATE ON letters BEGIN
  INSERT INTO letters_fts (letters_fts, rowid, text) VALUES ('delete', old.id, old.text);
  INSERT INTO letters_fts (rowid, text) VALUES (new.id, new.text);
END;
