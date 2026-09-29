# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

About 20 family members on Nana's email list, of mixed ages, some older and less comfortable with technology. They already know Nana. They arrive to read, often in the morning, and reach the site through a shared family passphrase. The admin (Jacob) is a separate, single-person audience using an editing screen.

## Product Purpose

Since February 2018 Nana has emailed the family every morning: updates on everyone, her own life, and her thoughts on the world. The site is a searchable, browsable archive of those letters (2,851 so far, 2018-02-06 to 2026-09-27) and receives no new letters automatically yet. Success is that family members come back regularly, read a letter, perhaps comment, and can find what she said on a given day or topic. A second, co-equal goal is that the project is a vehicle for doing CI/CD and release engineering properly, but the reader experience wins any conflict.

## Positioning

It holds one person's real daily voice across eight years, shared only with the people who know her. It is a kept collection of letters, not a meditation app or a blog. The audience is family only, never a public or shareable link.

## Operating Context

Letters are ingested from a Google Takeout mbox of Nana's forwarded-meditation emails. Only her own text is stored; the forwarded Richard Rohr / CAC meditation body is never copied, only its title and a resolved link out to cac.org. Some letters carry photos, stored in R2. Deployed as one Cloudflare Worker (React, Hono, D1 with FTS5). The prod database is the only copy of the letters, so data safety outranks convenience.

## Capabilities and Constraints

- Family-facing pages: On this day (home, with a nearby-days fallback), Browse (year then month), Letter view, Search (full text plus date range), and flat, un-threaded comments posted live with a homepage feed of recent ones.
- Admin-only edit screen, review queue, calendar view and analytics, behind a separate passphrase. It is exempt from the family-facing design bar.
- Non-goals for v1: notifications, digests, RSS, export or PDF, a standalone photo gallery, and extra per-letter metadata beyond date and meditation title.
- Two-tier auth: shared family passphrase, stronger admin passphrase.
- Ongoing ingestion is deliberately on hold (issue #6). Alerting is issue #2.
- Site name shown to family is "The Daily". The repo and project name stays "Nana's Letters".

## Brand Commitments

Family-facing name "The Daily". The tone is calm, warm and personal, like a kept letter. This is a binding constraint from the existing decided UI direction (the "Morning Paper" look) recorded in CLAUDE.md, and it is not re-decided here.

## Evidence on Hand

2,851 real letters in prod D1, with local backfill material under `backfill/` and `Mail/`. Real photo attachments exist (a Dec 2023 family picture). There are no testimonials or usage claims to cite. Analytics exist but no figures are recorded here.

## Product Principles

1. Nana's words come first: reading, finding and trusting a letter outranks any feature or pipeline nicety.
2. Family-only and low-friction: no accounts, no instructions needed, comfortable for the least technical relative.
3. Never copy what isn't hers: link out to the meditation, don't reproduce it.
4. Data safety is a product feature: letters are irreplaceable, and changes are additive and backed up.
5. A small, calm site: resist dashboards, engagement mechanics and decoration that don't serve reading.

## Accessibility & Inclusion

Many readers are older or non-technical, so legibility, generous touch targets, semantic elements and obvious navigation are requirements, not polish. Semantic HTML (real links and buttons) is a decided baseline. Motion respects `prefers-reduced-motion`.
