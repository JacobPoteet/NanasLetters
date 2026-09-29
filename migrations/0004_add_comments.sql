-- Family comments on a letter (Jacob's decision, superseding the earlier
-- "no comments" v1 non-goal — see CLAUDE.md). No pre-moderation queue: a
-- comment posts live immediately, and moderation is reactive (delete a
-- comment, ban the device, wipe everything from a device) rather than
-- preventive, per Jacob's own framing of expected volume.
--
-- Additive only, per CLAUDE.md's "prod database is the only copy that
-- matters" rule.

-- Generic key/value flags, first used for comments_require_login (below).
-- Deliberately its own table rather than reusing ingestion_state, which is
-- scoped to ingestion bookkeeping, not family-facing feature toggles.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Today every /api/* route already requires a family session (see
-- worker/index.ts's mount order), so this flag is a no-op in practice —
-- it exists so that the day the site's reading opens up publicly, comment
-- posting already has its own independent login check instead of needing
-- one invented from scratch. See CLAUDE.md.
INSERT INTO settings (key, value) VALUES ('comments_require_login', 'true');

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  letter_id INTEGER NOT NULL REFERENCES letters(id),
  -- Same client-generated device id concept as analytics_visits (a random
  -- UUID in localStorage) — reused as the identity a ban acts on, not a new
  -- identity scheme. Known to be trivially resettable by clearing storage;
  -- ip_hash below exists as a secondary signal for exactly that case.
  device_id TEXT NOT NULL,
  -- HMAC(SESSION_SECRET, CF-Connecting-IP) — never the raw IP. Lets the
  -- admin panel flag "this looks like the same visitor" after a device-id
  -- ban is evaded by clearing storage. Null in local dev, where Cloudflare
  -- never sets the header.
  ip_hash TEXT,
  author_name TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_comments_letter ON comments(letter_id, status, created_at);
CREATE INDEX idx_comments_device ON comments(device_id);
CREATE INDEX idx_comments_recent ON comments(status, created_at);

-- A banned device's future comments are rejected at write time (see
-- worker/routes/comments.ts) — this is the enforcement list, not a log of
-- past incidents (comments themselves, soft-deleted or not, are that log).
CREATE TABLE comment_bans (
  device_id TEXT PRIMARY KEY,
  reason TEXT,
  banned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
