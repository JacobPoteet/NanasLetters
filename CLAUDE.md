# Nana's Letters

An archive of the morning emails Nana has sent the family since February 2018, shown to family as
"The Daily": one Cloudflare Worker serving a React site, a Hono API, D1 and R2. The audience is
family only, behind a passphrase, never a public or shareable link. The project is also practice
for CI/CD and release engineering, so pipeline correctness counts as much as features, but never at
the cost of the letters being harder to read, search or trust.

Follows the workflow standard in the user CLAUDE.md: squash merges, `/ship` to land a PR,
`/release` to cut one, bugs fixed when found. Deviations are listed at the end. This file holds
rules; the design, the parsing findings, the roadmap and the reasons behind each rule live in the
wiki (see "Documentation").

## Commands

```bash
npm run dev                # local dev server
npm test                   # every unit test CI runs; never a fast subset
npm run check              # typecheck, zero tolerance
npm run lint               # oxlint, zero tolerance
npm run build              # production build
npm run deploy             # build + wrangler deploy ONLY: never applies migrations
npm run db:migrate         # migrations, LOCAL db
npm run db:migrate:remote  # migrations, PROD db
npm run db:seed            # LOCAL fixture letters only, never real ones
npm run db:export:remote   # PROD dump to the gitignored backups/. Run before any prod DB work
npm run archive            # read-only prod export to the gitignored archives/; --no-pdf skips PDFs
npm run admin              # local browser straight into an admin session via /dev-login
```

## The prod database is the only copy

No seed regenerates a letter Nana sent. These hold without exception:

1. `db:seed` never runs against prod.
2. Migrations are additive. Never drop or rewrite a column holding letter content without a
   verified export first.
3. Nothing prunes letters: no retention window, no cleanup script. Only a deliberate one-at-a-time
   admin delete removes a row.
4. A change that ships a migration goes out through `deploy.yml` (a `v*` tag or a manual dispatch),
   the only path that migrates before deploying. A bare `npm run deploy` once shipped code against
   tables prod did not have yet.
5. The daily backup (`worker/backup.ts`) covers every table in `BACKUP_TABLES`. A new table goes in
   that list in the same PR. `letters_fts` is derived and stays out.

## Parsing rules

`extractLetter` is a pure fold with fixtures from real letters. The wiki's Parsing note has the
findings behind each rule.

| Rule | Why |
| --- | --- |
| Store only Nana's own text. Keep the meditation's title and resolved link, never its body | The meditation is a copyrighted newsletter |
| Split at the first quoted or forwarded block, from the growable marker list | The forward marker changed across years; some letters forward a forward |
| The date comes from the outer email's `Date` header | Subject formats changed across years |
| Filter by sender (`NANA_ADDRESS` in `scripts/import-mbox.ts`), never by label alone | A Gmail label covers the whole thread, family replies included |
| Match both apostrophes, U+0027 and U+2019, in subject patterns | 2026 subjects use the curly one |
| Store only the resolved `cac.org` URL. Never the tracking href, never a slug built from the title | Tracking links are tied to Nana's subscription; guessed slugs land on the wrong page |
| Dedup within a calendar day before insert | Nana sometimes sends near-identical copies minutes apart |
| A parse the code doubts goes to the review queue | A wrong row in prod is worse than a queued one |
| `htmlToText` drops `<style>` and `<script>` contents | Some emails have no real plain-text part |

## Code rules

| Rule | Why |
| --- | --- |
| Pure logic lives in folds with a test beside each; handlers query and return | Keeps `npm test` meaningful and the handler layer thin |
| `worker/` has no DOM lib, `src/` does | Enforced by the tsconfig project split |
| Runtime deps are `hono`, `react`, `react-dom`. Adding one is a Decision Log row in the wiki | Each one was left out on purpose |
| Search snippets go through `escapeAndMarkSnippet` | `snippet()` escapes nothing around its delimiters |
| Family-facing CSS uses tokens, never a literal colour | A literal breaks dark mode. Dark values live only under `:root[data-theme="dark"]` |
| Motion sits inside `prefers-reduced-motion: no-preference`; every control gets a `:focus-visible` ring | Accessibility baseline |
| Real `<a>` and `<button>`, never a clickable `<div>` | Accessibility baseline |
| The admin screens skip the family design bar | Jacob's own tool: fast beats calm |
| `tsc -b` can report a stale pass after a `shared/` type change; force it | Incremental build graph |
| No emoji in the UI, no comments that restate the code | |

## Secrets

| Kind | Lives in |
| --- | --- |
| `SESSION_SECRET`, `FAMILY_PASSPHRASE`, `ADMIN_PASSPHRASE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | `wrangler secret put` only. CI never sees or prints them |
| `DEV_LOGIN_TOKEN` | `.dev.vars` only. Never `wrangler secret put`, never an Actions secret: its absence keeps `/dev-login` a 404 everywhere but a dev machine |
| Deploy token, account id | GitHub Actions secrets |
| A D1 database id, an account id | Not secrets; they identify without granting access, so they can sit in `wrangler.jsonc` |

When unsure, treat it as a secret. A new Worker secret or binding goes in the committed `.example`
file in the same PR, or CI's generated types miss it.

## CI

| Workflow | Fires on | Does |
| --- | --- | --- |
| `ci.yml` | every PR to `main`; pushes to `main` outside `**.md` | test, check, lint, then `CI gate`, the required check |
| `codeql.yml` | push and PR to `main` outside `**.md`, weekly | security and quality scan |
| `deploy.yml` | a `v*` tag, or manual dispatch | re-runs test and check, migrates prod, deploys |

`ci.yml`'s `changes` job skips the test job when a PR touches only `**.md`, so doc PRs still get a
`CI gate` result. Keep its skip list and `codeql.yml`'s `paths-ignore` in step: Actions has no YAML
anchors. CI runs migrations, never the seed. A change to a workflow, a migration or a secret gets a
second read of the workflow diff itself and a trace of what the next tag push would do.

## Verify a change

`npm test && npm run check && npm run lint`, then `npm run dev` and use the change by hand: open a
letter, search, browse. For a pipeline change, also trace the next tag push.

## Cutting a release

Run `/release`. The version lives only in the tag; `package.json`'s `0.1.0` is unused, so there is
no version file to bump. Notes go on the GitHub release. The tag push runs `deploy.yml`; afterwards
open the live site and check a letter, Search, and anything the release touched.

## Documentation

The wiki holds the documentation: design, parsing findings, roadmap, bootstrap record, Decision Log.
Its path is in the gitignored `.claude/wiki-path.local`. The repo keeps `README.md`, this file, and
the workflow files.

## Deviations from the standard

None.
