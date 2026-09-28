# CLAUDE.md — Nana's Letters

For close to 10 years, Nana has sent a morning email to the family — updates on everyone, her own life, and her thoughts on the world — appended ahead of a daily meditation email she reads and forwards onward. Roughly 2,000 of these live today in Jacob's Gmail under the `meditation` label, and she still writes one every morning, so this is never a one-shot import: ingestion has to keep working forever, not just on day one. The audience is family only — people who already know Nana — never a public or shareable link.

The point of the project isn't the archive itself — it's the pipeline around it: a small, real, personally-meaningful app used as the vehicle for doing CI/CD, DevOps, and release engineering properly. Treat pipeline correctness and safety as first-class requirements, not scaffolding around the "real" feature work. But the letters are the reason this exists, so a change that makes the pipeline more correct at the cost of the letters being harder to read, search, or trust is not a good trade — see "The prod database is the only copy that matters" below.

**This file is instructions, not documentation.** It carries what a change has to obey. Once the project has a wiki or a docs folder, move the reasoning behind a decision there and keep this file to the rules — see [Lunch Special's CLAUDE.md](../LunchSpecial/CLAUDE.md) for what that split looks like once it exists.

## Status: architecture is not finalized

Nothing below is locked in until noted otherwise. Sections marked **[decided]** are commitments; everything else is a working default carried over from Lunch Special's shape because it's a good default, not because it's been chosen for this project. Update this file the moment a real decision is made — an assumption written down and never corrected is worse than no assumption.

**[decided] Roadmap, in order** — don't skip ahead:

1. **Parsing experiment** (done — see "Parsing experiment findings" below): pull a sample of letters across different years from Gmail, figure out how to reliably separate Nana's own words from the meditation-email boilerplate/forwarding cruft she's replying inside of, and report conclusions before touching a database schema.
2. **Functionality** (done — see "Functionality" section below): what the site actually does for a family member — read, search, browse.
3. **Tech stack** (done — see "Tech stack" section below): chosen to serve #2, not assumed up front.
4. **UI/layout** (done — see "UI/layout" section below): elegant, clean, calming, ethereal, meditative — it should feel like the thing it's archiving, not like an admin dashboard. Welcoming to family members specifically, not a generic "cool site."
5. **First implementation pass + CI/CD** (in progress — see "Implementation status" below): the walking skeleton is real and passes `npm test && npm run check && npm run lint`, but it isn't deployed and a few pieces of v1 scope are still stubbed.

Open questions, sharper now than "undecided" but not yet **[decided]**:

- **Ingestion, backfill**: confirmed source is Gmail label `Fwd: Richard Rohr Meditation` (label ID `Label_6064425115864008158`) on Jacob's account — 1,927 messages / 1,859 threads as of Sept 2026, not ~2,000 as first guessed. The earliest one under this subject pattern is Feb 6, 2018, not 10 years back — either the habit started later than remembered, or older letters exist under a different subject/label and haven't been located yet. Don't assume the second without checking once backfill actually starts.
- **Ingestion, ongoing [decided]**: keep polling Gmail via a Cron Trigger, same code path as backfill. **Cloudflare Email Routing was rejected** — it would require Nana to change a habit she's kept solo for 8+ years (add a new forward/CC target), where continued polling requires zero change from her: Jacob is already on her distribution list, so the letters already land in the mailbox this reads. The tradeoff is a single point of failure (Jacob's Gmail OAuth token), which is why ingestion health monitoring is a real requirement, not polish — see "Tech stack" below.
- **Auth [decided: two-tier]**: family viewers share one passphrase (Lunch Special's admin-password pattern, ~20 people on Nana's list) — no per-user accounts. **A separate, stronger admin passphrase** gates the editing screen below, since that one can rewrite archive content and shouldn't share a secret that ~20 people know.
- **What "archive" means [mostly decided]**: a searchable library, not just a chronological feed. Nana explicitly wants (a) full-text search over what the letters actually say, (b) search/filter by date or date range, and (c) an "on this day" surface — showing past letters written on today's month/day across the years. All three need a real per-letter date, stored as structured data, not buried in freeform text. Whether there's *additional* per-letter metadata (occasion, recipients) beyond date is still open, and depends on what's actually in the source emails.
- **Attachments/images [confirmed]**: some letters carry real photo attachments (a Dec 2023 letter has a 2MB `.jpg` of a family picture referenced in her own text). Object storage (R2) alongside D1 is needed, not a TEXT column — this is no longer speculative.

**Parsing experiment findings (roadmap step 1, done)** — real conclusions from reading samples across 2018–2026, to inform the ingestion parser once it's written:

- Every letter is Nana's own commentary followed by the quoted/forwarded daily meditation email underneath. **Don't split on a fixed delimiter string** — the forward marker itself has changed over the years (`-----Original Message-----` in 2018 vs `----- Forwarded Message -----` in 2023–2026), and some letters are a forward of a forward (someone else's email quoted beneath the meditation, beneath her words). The robust rule: everything before the *first* quoted/forwarded block is hers; everything from there down is not.
- **Only Nana's own text belongs in the database as the "letter."** The forwarded Richard Rohr / Center for Action and Contemplation meditation is a copyrighted third-party newsletter, and including its full body in every one of ~2,000 rows is both a rights question worth avoiding and just noise (unsubscribe links, footer promos, a "New at CAC" section) that nobody wants to search. Keep at most the day's meditation title as lightweight reference metadata, not its body.
- **Some recent messages have no genuine plain-text MIME part**, so a naive HTML-to-text conversion falls back to something that leaves raw CSS (`@media` blocks etc.) sitting in the output as visible junk text — seen in a Sept 2026 sample, not in 2018/2023 ones. The real parser needs its own HTML→text step that explicitly drops `<style>`/`<script>` node contents, not the convert-on-the-fly behavior of whatever tool was used to sample these.
- **Same-day duplicate sends happen** (three near-identical copies of one letter sent minutes apart have been seen). Dedup on the same calendar day is needed before a letter is inserted, not assumed away.
- The letter's date should come from the outer email's own `Date` header (when Nana sent the forward), never parsed out of the subject or body — subject-line format itself isn't stable across years (`Fwd: Richard Rohr Meditation: X` vs `Fw: Richard Rohr's Daily Meditation: X`).
- **The newsletter's own "read the full meditation" link is worth extracting and linking to — but never its raw href.** Every link in these emails (including that one) is wrapped in an `email.cac.org/t/...` tracking redirect tied to Nana's personal subscription, not a stable public URL — confirmed by resolving one, which landed on `https://cac.org/daily-meditations/an-influential-teacher/`. **Don't reconstruct this URL by slugifying the title either**: `blessed-are-the-peacemakers` 301s to a date-disambiguated slug, while `radical-resilience` resolves to a *different* page (that year's overarching theme, which reuses the meditation's title) — a guessed URL can silently land on the wrong page. The correct approach, and what's implemented: find the CTA anchor by its visible text (`findMeditationLinkHref`, matching both "READ ON CAC.ORG" and "Read this meditation on cac.org." — the wording itself changed eras too), then resolve that exact tracking link once at ingestion time (`resolveMeditationUrl`, a `HEAD` fetch following redirects) and store only the resolved `cac.org` URL. The 2018-era template has no such link at all (the whole meditation was inline) — that's an expected `null`, not a parsing failure.

## Functionality (v1 scope) **[decided]**

Five pages, one review queue. Nothing here is a nice-to-have layered on top of the archive — this *is* the archive.

- **On this day (home)**: letters written on today's month/day across every year, newest year first. A day with zero letters falls back to the nearest days within a window (clearly labeled as such, e.g. "from a few days either side") rather than showing an empty page — full daily coverage isn't guaranteed, especially before the archive's confirmed Feb 2018 start.
- **Browse**: plain chronological list (year → month), for a family member who just wants to read forward or back through time rather than search for something.
- **Letter view**: Nana's own text for that date, the date itself, any inline photo she attached, and the day's meditation title — **linked to the specific meditation's page on cac.org when one was resolved during ingestion**, plain text when it wasn't (older-format emails, or a resolution that failed). Never the meditation's own body: a link out satisfies "reference it in case she talks about it" without ever copying CAC's copyrighted text (see the URL-extraction finding under "Parsing experiment findings" above).
- **Search**: full-text over her letters' own words, combinable with a date-range filter, results shown as highlighted snippets linking to the full letter.
- **Admin edit screen**: gated by the separate admin passphrase above. Lets a bad parse (wrong date, bad split between her words and the forwarded block, a duplicate that should've been merged) get corrected by hand. Also the home for the **ingestion review queue** — any incoming letter the parser isn't confident about (no recognized forward marker, an unexpected subject shape, an ambiguous same-day duplicate) lands here for a human call instead of silently writing a wrong or duplicated row to prod.

Explicit non-goals for v1 — don't build these until asked:

- No comments, reactions, or any family-facing write access. The site is read-only for everyone but the admin.
- No notifications, email digests, or RSS. Family visits on their own.
- No export/download/PDF of letters.
- No standalone photo gallery — attachments show inline on their own letter only.
- No per-letter metadata beyond date + meditation title (no "occasion," no recipient list) unless a real need for it shows up.

## Tech stack **[decided]**

One Cloudflare Worker, same shape as Lunch Special, chosen to serve the v1 functionality spec above with as few moving parts (and as few new runtime dependencies) as possible.

- **Frontend**: React + Vite + `@cloudflare/vite-plugin`, served as Workers Static Assets from the same Worker — no separate frontend host, no separate build.
- **API**: Hono, same as Lunch Special.
- **Data**: D1. Letters, photos-metadata, ingestion state, and the review queue are relational and small (~1,900 rows today, growing by one a day) — nothing here needs a different database.
- **Full-text search: D1's built-in FTS5 virtual table**, not a separate search service. An external-content FTS5 table kept in sync via SQLite triggers on the base `letters` table (triggers run inside the same statement, sidestepping D1's lack of cross-statement transactions). `snippet()`/`highlight()` cover the highlighted-search-result requirement in the functionality spec for free.
- **Photos**: R2, one object per attachment. Served at original size in v1 — see [issue #1](https://github.com/JacobPoteet/NanasLetters/issues/1) for the deferred resize/thumbnail follow-up.
- **Auth**: signed HMAC session cookies (Lunch Special's pattern), carrying a `role` claim (`family` or `admin`) set by which passphrase was checked at login. Two secrets, not one — see Secrets below.
- **Ingestion (backfill and ongoing, same code path)**: a Cron Trigger calls the Gmail API directly over `fetch` — no Google API SDK. Auth is a Google OAuth **refresh token, scoped read-only** (`gmail.readonly`), minted once via a one-time interactive consent flow (a bootstrap step, like Lunch Special's `wrangler secret put` bootstrap) and exchanged for short-lived access tokens at runtime via a plain `fetch` to `oauth2.googleapis.com`. The backfill is the same cron logic run once against the full label history rather than a separate one-off importer, so there's only ever one parsing code path to trust.
- **Parsing** (`extractLetter`, a pure fold with fixtures from the real samples pulled during the parsing experiment): prefer a message's genuine `text/plain` MIME part when one exists (the 2018-era shape); otherwise take the HTML body and convert it to text. Then locate the first quoted/forwarded block via a small, growable list of known marker patterns and keep only what's above it.
- **HTML-to-text [corrected during implementation]: a hand-written pure fold (`worker/parsing/htmlToText.ts`), not `HTMLRewriter`** as originally decided above. `HTMLRewriter` only runs inside workerd, and this project's tests run under plain vitest like Lunch Special's — no `@cloudflare/vitest-pool-workers` — so a function depending on it couldn't be unit-tested the same way as every other pure fold. Stripping `<style>`/`<script>` and converting the rest to text turned out simple enough to hand-write instead, still with zero new npm dependencies, and still directly pins the CSS-junk bug the parsing experiment found (now a regression test).
- **Search-result safety**: SQLite's `snippet()` does not escape the surrounding text, it only inserts whatever delimiter string it's given — so `snippet()` is called with control characters as delimiters (bound as query params, never valid letter content) and a small pure fold (`escapeAndMarkSnippet`) HTML-escapes everything and turns only those delimiters into real `<mark>` tags before the client ever does a `dangerouslySetInnerHTML`. Found and fixed while wiring search up, not before — worth pinning here since it's the kind of bug that's invisible until someone's letter happens to contain a literal `<`.
- **Ingestion health monitoring**: since ongoing ingestion depends on one Gmail OAuth token staying valid forever, the Cron Trigger's failure state can't just fail silently — an alert (at minimum, an email to Jacob) is needed if a run errors, or if no new letter has appeared for several days running. This is the same "automated backup is not optional" reasoning as the prod-database section below, applied to ingestion instead of storage. Currently just `console.error`; real alerting is [issue #2](https://github.com/JacobPoteet/NanasLetters/issues/2), not v1.
- **Runtime dependencies, named** (per the Conventions rule below): `hono`, `react`, `react-dom`. Deliberately not: an HTML-to-text library, a full-text search library (D1 FTS5 instead), a Google API client SDK (`fetch` instead), a date library (SQL `strftime` instead), a client-side router (a ~40-line custom one instead — five flat routes don't need react-router).
- **Tooling**: mirrors Lunch Special's shape — vite + `@cloudflare/vite-plugin`, plain vitest (no workers pool, see above), oxlint, `tsc -b` with the same 3-project split (app/worker/node) — not its exact versions (this repo is on TypeScript 5, not Lunch Special's TS7/native-compiler setup, since nothing here needed that bleeding edge).

**Deferred work gets a GitHub issue, not just a mental note.** When something is a real, valuable idea but doesn't belong in the current scope (v1, or whatever's being built next), file it on [the repo](https://github.com/JacobPoteet/NanasLetters) with labels (`enhancement`/`bug`/etc. plus `post-v1`, `performance`, `ingestion` as they fit) instead of letting it evaporate or bloating this file. [Issue #1](https://github.com/JacobPoteet/NanasLetters/issues/1) (photo resizing) is the first example.

## UI/layout **[decided]**

Direction settled by mocking up real pages rather than describing them in the abstract — see [the UI directions artifact](https://claude.ai/artifact/Cf726kBKBdrfoee2hYdTa1) (private; not shared outside this account) for the actual comparison and the two mocked pages. "Morning Paper" won over a cooler, more literally "ethereal" alternative because Nana's letters are about coffee, gardens, church, and grandkids — a kept letter, not a meditation app.

- **Site name shown to family: "The Daily."** Not the same thing as the project/repo name ("Nana's Letters") — that stays as-is for the codebase, GitHub, and this file.
- **Palette**: warm ivory background (`#F6F1E7`), near-black warm ink for text (`#2B241C`), a rust/terracotta accent for years and links (`#B0522D` / a lighter `#8A6A55` for link text), muted warm gray-brown for secondary text (`#6B5F4F`, `#9C8E76` for the faintest labels), hairline dividers at `#E4DACB`.
- **Type**: Source Serif 4 for everything reading-facing (dates, headings, the letters themselves — display and body both, one family), Work Sans for UI chrome (nav, small labels, link affordances). Two typefaces, not three.
- **The year is the visual anchor** on any list of letters (a large serif number, not a colored tag or a left-border strip) — deliberately avoided the generic-AI-template look (no gradient washes, no left-border cards, no emoji, no Inter/Roboto/Arial).
- **The admin edit screen is explicitly exempt from this design bar** — same reasoning as Lunch Special's `/admin`: it's Jacob's own tool, not a family-facing surface, so utilitarian and fast beats calm and elegant there.
- Real semantic elements throughout (`<a>`/`<button>`, not a styled `<div>` with a click handler) — this is a decided accessibility baseline, not just a mockup artifact convention.

## Commands **[decided: shape, not final names]**

Every one of these must exist under these names once implementation starts, mirroring Lunch Special so the muscle memory transfers. `dev`/`build`/`deploy` run through the Vite + `@cloudflare/vite-plugin` toolchain named in "Tech stack" above; the rest are plain `wrangler`/`vitest`/`oxlint` invocations:

```bash
npm run dev          # local dev server, hot-reloading
npm test             # unit tests over every pure fold — no fold ships without one
npm run check        # typecheck, zero-tolerance
npm run lint         # lint, zero-tolerance
npm run build        # production build
npm run deploy       # build + deploy to production
npm run db:migrate         # apply migrations to LOCAL db
npm run db:migrate:remote  # apply migrations to PROD db
npm run db:seed            # seed LOCAL db only — bootstrap/dev-fixture data, never real letters
npm run db:export:remote   # dump PROD db → gitignored backups/ dir. Run before any prod DB work
```

Do not let `npm test` silently mean "the fast subset." One command, no flags, runs everything CI runs.

## Implementation status

The first pass exists and is real, not scaffolding-only: `npm test && npm run check && npm run lint && npm run build` all pass, and every page in the Functionality spec has been exercised by hand in a browser against seeded local data (login for both roles, on-this-day with its nearby-days fallback, browse in correct date order, search with highlighted snippets, a letter's prev/next nav, the admin review queue's resolve/dismiss, and the admin edit form saving a real change that shows up on the public letter view). What's still open before this is a finished v1, not a proof of concept:

- **Not deployed yet.** No `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` GitHub Actions secrets, no Worker secrets set via `wrangler secret put` — see "Deploy to Cloudflare" below for the real bootstrap checklist.
- **R2 bucket doesn't exist remotely.** `wrangler r2 bucket create` refused with "Please enable R2 through the Cloudflare Dashboard" (code 10042) — a one-time dashboard action only Jacob can do. The binding is already in `wrangler.jsonc` and works locally; only `wrangler deploy` needs the real bucket.
- **Gmail ingestion has no real credentials.** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` need a one-time Google Cloud project + OAuth consent flow before `runIngestion` can reach Gmail for real; the code path itself (list → fetch → parse → resolve meditation link → dedupe/review-queue) is written and unit-tested down to the pure folds, just never run against the live API.
- **Real alerting on ingestion failure** is [issue #2](https://github.com/JacobPoteet/NanasLetters/issues/2) — currently just `console.error`.

## Deploy to Cloudflare **[bootstrap steps, not yet performed]**

One-time setup, once someone's ready to actually go live:

1. R2: enable it via the Cloudflare dashboard (one click, account-level), then `npx wrangler r2 bucket create nanas-letters-photos`.
2. Gmail: create a Google Cloud project, enable the Gmail API, create an OAuth client (Desktop app type), and run the one-time interactive consent flow scoped to `gmail.readonly` to mint a refresh token.
3. `npx wrangler secret put SESSION_SECRET`, `FAMILY_PASSPHRASE`, `ADMIN_PASSPHRASE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` — interactive, run in your own terminal, never in CI.
4. GitHub Actions secrets: `CLOUDFLARE_API_TOKEN` (Workers + D1 + R2 edit scopes), `CLOUDFLARE_ACCOUNT_ID` (`9016037cfaa0836d9bbc85d754935cb5` — not a secret in the sense of needing hiding, but it lives as an Actions secret alongside the token for convenience).
5. `npm run deploy`, then verify: log in with the family passphrase, confirm the on-this-day page loads.
6. Trigger the backfill once, manually (`wrangler triggers` or a manual Cron Trigger invocation) rather than waiting for the daily schedule, and watch `review_queue` afterward — the first real run against ~1,900 messages is exactly when an unanticipated format shows up.

D1 is already bootstrapped: `nanas-letters-db` exists (`eb455876-47d8-41d6-bf7d-5cc77568cc36`, committed in `wrangler.jsonc` since a database ID identifies but doesn't grant access — see Secrets below), and `npm run db:migrate:remote` is safe to run any time (additive, idempotent).

## The prod database is the only copy that matters

This is the one place Nana's Letters is *more* strict than Lunch Special, not less. Lunch Special's prod-only data (schedules, analytics) is reconstructable or disposable if lost. **Nana's letters are not.** There is no seed file that regenerates a real email Nana sent in March. Losing prod data here means losing actual family memories, not a game catalog.

Consequences that are non-negotiable once the DB exists:

1. **`db:seed` must never be runnable against prod**, and ideally shouldn't even accept a `--remote` flag the way Lunch Special's does — the blast radius of a fat-fingered seed here is categorically worse than replacing a dish schedule.
2. **A scheduled, automated backup is not optional polish — build it early.** A Cron Trigger that exports D1 (or replicates new rows) to R2 on a schedule, not just a manual `db:export:remote` someone has to remember to run before "risky" work. Manual export is a good pre-migration habit; it is not a backup strategy for irreplaceable data.
3. **Migrations are additive only, forever.** Never a migration that drops or rewrites a column holding letter content without a verified export first.
4. Decide and document the retention story explicitly: does *everything* Nana ever sends get kept forever? Almost certainly yes — but write that down here once it's confirmed, so a future cleanup script doesn't "helpfully" prune old rows.

## CI/CD

### Workflows

| Workflow | Fires on | Does |
|---|---|---|
| `ci.yml` | push + PR to `main` | `npm test` → `npm run check` → `npm run lint` |
| `codeql.yml` | push + PR to `main`, weekly cron | security-and-quality scan |
| `deploy.yml` | version tag (`v*`), or manual dispatch | re-runs test + check + remote migrate + deploy |

Four rules, carried over from Lunch Special because they were each learned the hard way there:

- **`ci.yml` and `codeql.yml` must share an identical `paths-ignore`.** GitHub Actions has no YAML anchors, so this has to be kept in sync by hand on every edit to either. If CI is ever made a required status check, a shared `paths-ignore` will hang doc-only PRs forever waiting on a check that never runs — switch to an always-running gate job at that point, don't try to special-case it.
- **Any generated config/types file (the equivalent of `worker-configuration.d.ts`) must be regenerated in CI from a committed `.example` file, never hand-maintained in the repo and never assumed present.** A new secret or binding has to be added to the example file in the same PR that adds it, or CI can't see it and the build fails somewhere confusing.
- **`deploy.yml` re-runs test + check itself.** It never trusts that some earlier CI run on some earlier commit passed. The deploy gate is the last line of defense, not a formality.
- **CI runs migrations (additive, idempotent) but never runs the seed**, on any environment, ever.

### Secrets

- **Application secrets**: `SESSION_SECRET`, `FAMILY_PASSPHRASE`, `ADMIN_PASSPHRASE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (the Gmail read-only OAuth token, minted once via a one-time consent flow — the actual bootstrap steps belong in a "Deploy to Cloudflare" section once there's a live environment to bootstrap). All live in the platform's secret store (`wrangler secret put`) and persist across deploys — CI never touches them, never prints them, never has them in an env file that gets committed.
- **CI credentials** (deploy token, account ID) live only as GitHub Actions secrets.
- A resource ID that identifies an account or database but grants no access on its own (a D1 database UUID, a Cloudflare account ID) is not a secret and can live in a committed config file — same reasoning Lunch Special uses for its `database_id` and `GITHUB_REPO`. Don't over-classify; don't under-classify either — when unsure, treat it as a secret.

### Before merging a change that touches the pipeline itself

Changing `ci.yml`, `deploy.yml`, or anything migrations/secrets-related is riskier than changing application code, because a broken pipeline can fail silently (a required check that never runs, a deploy that "succeeds" against the wrong environment). Any such change gets a deliberate second look before merge — read the diff of the workflow file itself, not just the app code around it, and confirm what would happen on the next real tag push, not just the next PR.

## Layout **[decided]**

Mirrors Lunch Special's split, which is what made that codebase easy to reason about:

- `worker/` — Hono routes, the Cron Trigger's ingestion handler, and every pure fold (`extractLetter`, the forward-marker splitter, session token verify) with its test beside it.
- `shared/` — types imported by both `worker/` and the frontend, so the API and the UI can't silently drift.
- `src/` — the React app.
- `migrations/` — additive-only D1 schema changes (see "The prod database is the only copy that matters").
- `seed/` — local-only dev fixture letters (a handful of representative samples across the format eras found in the parsing experiment), never real letters.

- **Pure logic lives apart from routes/handlers, and every pure fold has a unit test beside it.** Query/receive in the handler, fold in a plain function, assert on the fold. This is what makes `npm test` meaningful and keeps the handler layer thin enough that most bugs never reach it.
- **One clear rule for what's client-visible vs. server-only**: `worker/` gets no DOM lib, `src/` gets DOM, enforced by the tsconfig project split, not by convention alone.

## Conventions

- Don't add a dependency casually. Runtime deps are named in "Tech stack" above (`hono`, `react`, `react-dom`, and nothing else) — treat any addition as a decision worth a sentence there.
- Something worth doing but out of current scope gets a GitHub issue (see "Tech stack" above), not a comment, a TODO, or a note that only lives in someone's memory of this conversation.
- `tsc -b` (or whatever the typecheck command is) can report stale success on an incremental build graph if the underlying tool supports incremental builds — know the force/clean flag for "I changed a shared type and don't trust the cache" before it costs you a debugging session.
- No emoji, no filler comments. Comments explain *why*, never *what* — see the root guidance this file inherits from the harness for the full rule.

## Verify a change

`npm test && npm run check && npm run lint`, then run the app locally and exercise the actual change by hand — reading an email in the archive, or whatever the equivalent is once real features exist. For anything touching the pipeline (workflows, migrations, secrets), additionally trace through what happens on the next tag push before merging, per the rule above.

## Documentation

Undecided. Lunch Special keeps all reasoning in an external wiki and treats CLAUDE.md as instructions-only; that split is worth adopting here too once there's enough non-obvious reasoning to justify a second home for it. Until then, keep this file itself terse and rule-shaped, and don't let it grow into a design doc.
