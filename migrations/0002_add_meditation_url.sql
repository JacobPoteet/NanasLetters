-- Additive only, per CLAUDE.md's "prod database is the only copy that
-- matters" rule.
--
-- A reference link to that day's meditation on cac.org, resolved once at
-- ingestion time from the newsletter's own "read the full meditation" link
-- (never the meditation's own body — see the copyright/noise reasoning in
-- CLAUDE.md's parsing findings, which this satisfies without storing any of
-- CAC's copyrighted text: a link out, not a copy).

ALTER TABLE letters ADD COLUMN meditation_url TEXT;
