# CLAUDE.md — Nana's Letters

For close to 10 years, Nana has sent a morning email to the family — updates on everyone, her own life, and her thoughts on the world — appended ahead of a daily meditation email she reads and forwards onward. Roughly 2,000 of these live today in Jacob's Gmail under the `meditation` label, and she still writes one every morning, so this is never a one-shot import: ingestion has to keep working forever, not just on day one. The audience is family only — people who already know Nana — never a public or shareable link.

The point of the project isn't the archive itself — it's the pipeline around it: a small, real, personally-meaningful app used as the vehicle for doing CI/CD, DevOps, and release engineering properly. Treat pipeline correctness and safety as first-class requirements, not scaffolding around the "real" feature work. But the letters are the reason this exists, so a change that makes the pipeline more correct at the cost of the letters being harder to read, search, or trust is not a good trade — see "The prod database is the only copy that matters" below.

**This file is instructions, not documentation.** It carries what a change has to obey. Once the project has a wiki or a docs folder, move the reasoning behind a decision there and keep this file to the rules — see [Lunch Special's CLAUDE.md](../LunchSpecial/CLAUDE.md) for what that split looks like once it exists.

## Status: architecture is not finalized

Nothing below is locked in until noted otherwise. Sections marked **[decided]** are commitments; everything else is a working default carried over from Lunch Special's shape because it's a good default, not because it's been chosen for this project. Update this file the moment a real decision is made — an assumption written down and never corrected is worse than no assumption.

**[decided] Roadmap, in order** — don't skip ahead:

1. **Parsing experiment** (current phase): pull a sample of letters across different years from Gmail, figure out how to reliably separate Nana's own words from the meditation-email boilerplate/forwarding cruft she's replying inside of, and report conclusions before touching a database schema.
2. **Functionality**: what the site actually does for a family member — read, search, browse — based on what the parsing experiment shows is actually extractable (e.g. per-letter date is certain; per-letter "occasion" metadata may not exist and shouldn't be invented).
3. **Tech stack**: chosen to serve #2, not assumed up front. Cloudflare + a single Worker is decided (below); everything inside that is not.
4. **UI/layout**: elegant, clean, calming, ethereal, meditative — it should feel like the thing it's archiving, not like an admin dashboard. Welcoming to family members specifically, not a generic "cool site."
5. **First implementation pass + CI/CD**, mirroring Lunch Special's pipeline shape below.

Open questions, sharper now than "undecided" but not yet **[decided]**:

- **Ingestion, backfill**: confirmed source is Gmail label `Fwd: Richard Rohr Meditation` (label ID `Label_6064425115864008158`) on Jacob's account — 1,927 messages / 1,859 threads as of Sept 2026, not ~2,000 as first guessed. The earliest one under this subject pattern is Feb 6, 2018, not 10 years back — either the habit started later than remembered, or older letters exist under a different subject/label and haven't been located yet. Don't assume the second without checking once backfill actually starts.
- **Ingestion, ongoing**: she still writes one every morning. Candidates: keep polling Gmail via a scheduled Worker (Cron Trigger) hitting the Gmail API, or switch to Cloudflare Email Routing (a Worker email handler on a dedicated address she's forwarded/CC'd on) so new mail never depends on a Gmail OAuth token staying valid. Decide once the backfill approach is settled — the two don't have to be the same mechanism.
- **Auth**: family-only access. Leading candidate is a single shared passphrase (Lunch Special's admin-password pattern), not per-user accounts, since the audience is small and fixed. Decide before building any login screen.
- **What "archive" means [mostly decided]**: a searchable library, not just a chronological feed. Nana explicitly wants (a) full-text search over what the letters actually say, (b) search/filter by date or date range, and (c) an "on this day" surface — showing past letters written on today's month/day across the years. All three need a real per-letter date, stored as structured data, not buried in freeform text. Whether there's *additional* per-letter metadata (occasion, recipients) beyond date is still open, and depends on what's actually in the source emails.
- **Attachments/images [confirmed]**: some letters carry real photo attachments (a Dec 2023 letter has a 2MB `.jpg` of a family picture referenced in her own text). Object storage (R2) alongside D1 is needed, not a TEXT column — this is no longer speculative.

**Parsing experiment findings (roadmap step 1, done)** — real conclusions from reading samples across 2018–2026, to inform the ingestion parser once it's written:

- Every letter is Nana's own commentary followed by the quoted/forwarded daily meditation email underneath. **Don't split on a fixed delimiter string** — the forward marker itself has changed over the years (`-----Original Message-----` in 2018 vs `----- Forwarded Message -----` in 2023–2026), and some letters are a forward of a forward (someone else's email quoted beneath the meditation, beneath her words). The robust rule: everything before the *first* quoted/forwarded block is hers; everything from there down is not.
- **Only Nana's own text belongs in the database as the "letter."** The forwarded Richard Rohr / Center for Action and Contemplation meditation is a copyrighted third-party newsletter, and including its full body in every one of ~2,000 rows is both a rights question worth avoiding and just noise (unsubscribe links, footer promos, a "New at CAC" section) that nobody wants to search. Keep at most the day's meditation title as lightweight reference metadata, not its body.
- **Some recent messages have no genuine plain-text MIME part**, so a naive HTML-to-text conversion falls back to something that leaves raw CSS (`@media` blocks etc.) sitting in the output as visible junk text — seen in a Sept 2026 sample, not in 2018/2023 ones. The real parser needs its own HTML→text step that explicitly drops `<style>`/`<script>` node contents, not the convert-on-the-fly behavior of whatever tool was used to sample these.
- **Same-day duplicate sends happen** (three near-identical copies of one letter sent minutes apart have been seen). Dedup on the same calendar day is needed before a letter is inserted, not assumed away.
- The letter's date should come from the outer email's own `Date` header (when Nana sent the forward), never parsed out of the subject or body — subject-line format itself isn't stable across years (`Fwd: Richard Rohr Meditation: X` vs `Fw: Richard Rohr's Daily Meditation: X`).

## Commands **[decided: shape, not final names]**

The exact scripts depend on the stack chosen below, but every one of these must exist under these names once the stack is real, mirroring Lunch Special so the muscle memory transfers:

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

- **Application secrets** (session secret, any shared family passphrase, third-party API keys) live in the platform's secret store (`wrangler secret put` or equivalent) and persist across deploys — CI never touches them, never prints them, never has them in an env file that gets committed.
- **CI credentials** (deploy token, account ID) live only as GitHub Actions secrets.
- A resource ID that identifies an account or database but grants no access on its own (a D1 database UUID, a Cloudflare account ID) is not a secret and can live in a committed config file — same reasoning Lunch Special uses for its `database_id` and `GITHUB_REPO`. Don't over-classify; don't under-classify either — when unsure, treat it as a secret.

### Before merging a change that touches the pipeline itself

Changing `ci.yml`, `deploy.yml`, or anything migrations/secrets-related is riskier than changing application code, because a broken pipeline can fail silently (a required check that never runs, a deploy that "succeeds" against the wrong environment). Any such change gets a deliberate second look before merge — read the diff of the workflow file itself, not just the app code around it, and confirm what would happen on the next real tag push, not just the next PR.

## Layout **[placeholder — fill in once the stack is chosen]**

Whatever the stack turns out to be, keep the separation that made Lunch Special's codebase easy to reason about:

- **Pure logic lives apart from routes/handlers, and every pure fold has a unit test beside it.** Query/receive in the handler, fold in a plain function, assert on the fold. This is what makes `npm test` meaningful and keeps the handler layer thin enough that most bugs never reach it.
- **Shared types live in one place**, imported by both server and client code, so the two sides of the API can't silently drift.
- **One clear rule for what's client-visible vs. server-only**, decided once and enforced by the type boundary (e.g. worker code with no DOM lib, app code with DOM) rather than by convention alone.

## Conventions

- Don't add a dependency casually. Justify it the way Lunch Special does — name the runtime deps in this file once the stack is chosen, and treat any addition as a decision worth a sentence here.
- `tsc -b` (or whatever the typecheck command is) can report stale success on an incremental build graph if the underlying tool supports incremental builds — know the force/clean flag for "I changed a shared type and don't trust the cache" before it costs you a debugging session.
- No emoji, no filler comments. Comments explain *why*, never *what* — see the root guidance this file inherits from the harness for the full rule.

## Verify a change

`npm test && npm run check && npm run lint`, then run the app locally and exercise the actual change by hand — reading an email in the archive, or whatever the equivalent is once real features exist. For anything touching the pipeline (workflows, migrations, secrets), additionally trace through what happens on the next tag push before merging, per the rule above.

## Documentation

Undecided. Lunch Special keeps all reasoning in an external wiki and treats CLAUDE.md as instructions-only; that split is worth adopting here too once there's enough non-obvious reasoning to justify a second home for it. Until then, keep this file itself terse and rule-shaped, and don't let it grow into a design doc.
