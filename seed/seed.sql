-- Local dev fixture data ONLY — never real letters (see CLAUDE.md's
-- "The prod database is the only copy that matters"). Fictional content,
-- written to span a few of the format eras found during the parsing
-- experiment, so the app has something real to look at under `npm run dev`.

DELETE FROM comments;
DELETE FROM letter_photos;
DELETE FROM review_queue;
DELETE FROM letters;

-- Three letters on today's month/day in different years, so the "on this
-- day" home page has something to show immediately after seeding. One has no
-- meditation_url, to demo the plain-text fallback for eras/emails where the
-- newsletter had no "read the full meditation" link to resolve.
INSERT INTO letters (date, text, meditation_title, meditation_url, gmail_message_id) VALUES
  (date('now'), 'The tomatoes finally came in, and of course it happened the same week the rain would not stop. Give the kids a hug from me if you see them this week.', 'A Full Prophet', 'https://cac.org/daily-meditations/a-full-prophet/', 'seed-today'),
  (date('now', '-1 year'), 'Church was full this morning, which always makes your grandfather happier than he lets on. The zinnias have decided to take over the whole bed, and I have stopped arguing with them about it.', 'The Long Way Home', 'https://cac.org/daily-meditations/the-long-way-home/', 'seed-last-year'),
  (date('now', '-3 year'), 'It is quiet here today, just birds and the coffee pot, which is exactly the kind of morning I needed before the week gets going.', 'Radical Resilience', NULL, 'seed-three-years-ago');

-- A handful of other letters for Browse and Search to have something to page
-- and match through.
INSERT INTO letters (date, text, meditation_title, meditation_url, gmail_message_id) VALUES
  ('2024-05-01', 'I love this one, of course, but I also acknowledge we are still responsible for doing our part. Your cousin called last night with news I will let her share herself, but I have been smiling since.', 'The Joy of Simplicity', 'https://cac.org/daily-meditations/the-joy-of-simplicity/', 'seed-2024-05-01'),
  ('2023-12-31', 'New picture with the family today, and the last paragraph is what I hope will anchor my fears about the year ahead. Enjoy the New Year.', 'Radical Resilience', NULL, 'seed-2023-12-31'),
  ('2021-09-24', 'We got the whole gang together for pancakes before the long drive back, and I keep looking at this picture.', 'Seeing the Divine Image Everywhere', NULL, 'seed-2021-09-24'),
  ('2019-02-06', 'I could not have said it better myself this morning. Well, happy Olympics tomorrow!', 'Blessed Are the Peacemakers', NULL, 'seed-2019-02-06');

-- One letter with a placeholder photo, so the inline-photo layout has
-- something to render locally.
INSERT INTO letter_photos (letter_id, r2_key, mime_type, caption)
  SELECT id, 'seed/placeholder.jpg', 'image/jpeg', 'The zinnias, mid-takeover.'
  FROM letters WHERE gmail_message_id = 'seed-last-year';

-- One review-queue item, so the admin page has something to act on locally.
INSERT INTO review_queue (gmail_message_id, reason, received_date, raw_text) VALUES
  ('seed-review-1', 'no_forward_marker', date('now', '-2 days'), 'Just a quick note today, nothing forwarded beneath it — the parser could not find a quoted block to split on.');

-- A couple of comments, so the homepage feed, the letter view's thread, and
-- the admin comments panel all have something to show locally.
INSERT INTO comments (letter_id, device_id, ip_hash, author_name, body)
  SELECT id, 'seed-device-1', NULL, 'Aunt Carol', 'The zinnias! I remember when you planted those.'
  FROM letters WHERE gmail_message_id = 'seed-last-year';
INSERT INTO comments (letter_id, device_id, ip_hash, author_name, body)
  SELECT id, 'seed-device-2', NULL, NULL, 'Made me cry a little this morning. Love you, Grandma.'
  FROM letters WHERE gmail_message_id = 'seed-today';
