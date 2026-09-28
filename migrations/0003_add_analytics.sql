-- Anonymous, operational-visibility-only usage analytics (GitHub #8).
-- One row per page visit, keyed by a client-generated device id (random
-- UUID in localStorage, never tied to the shared family/admin login). No
-- per-person tracking, no engagement optimization -- just "is this working,
-- roughly what scale" (Jacob's own framing on the issue).
--
-- Additive only, per CLAUDE.md's "prod database is the only copy that
-- matters" rule.

CREATE TABLE analytics_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Server-stamped UTC calendar day, not client-supplied — a device has no
  -- authority over what day it says it is.
  visit_day TEXT NOT NULL,
  device_id TEXT NOT NULL,
  page TEXT NOT NULL CHECK (page IN ('home', 'browse', 'letter', 'search')),
  -- Set only when page = 'letter' — which letter was read, for the "most
  -- read" panel. NULL for every other page.
  letter_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_analytics_visits_day ON analytics_visits(visit_day);
CREATE INDEX idx_analytics_visits_letter ON analytics_visits(letter_id);
CREATE INDEX idx_analytics_visits_device ON analytics_visits(device_id);
