// One-time backfill: parses the Google Takeout mbox export and writes a SQL
// file to apply against D1. Local-only tooling, run with `tsx`, never part
// of the Worker bundle — that's why mailparser/tsx are devDependencies and
// don't count against CLAUDE.md's "three runtime deps" decision.
//
// Reuses the exact same parsing pure folds the (currently on-hold) live
// Gmail-API ingestion path uses, so there's still only one parsing pipeline
// to trust, per CLAUDE.md's tech-stack decision — the two orchestrators
// (this script vs. the future Cron Trigger) differ only in where the raw
// message bytes come from.
//
// Usage: npx tsx scripts/import-mbox.ts "<path to .mbox>"

import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { simpleParser } from "mailparser";
import { extractLetter, type RawMessage } from "../worker/parsing/extractLetter";
import { resolveMeditationUrl } from "../worker/ingestion/meditationLink";
import { isSameLetter } from "../worker/ingestion/duplicate";
import type { ReviewReason } from "../shared/types";

// Nana's actual sending address, confirmed during the parsing experiment.
// Everything else under this label is another family member's reply within
// the same thread (Gmail applies a label to a whole thread, not just the
// message that earned it) — real correspondence, but not one of her
// letters, so it's filtered out here rather than imported or reviewed.
const NANA_ADDRESS = "nmshill@aol.com";

// Gmail Takeout's mbox separator: "From <numeric-thread-id>@xxx <date>".
// Deliberately specific (not the generic mbox "^From ") so a real message
// body line can never be mistaken for one — no mboxrd unescaping needed.
const SEPARATOR = /^From \d+@xxx /;

async function* splitMbox(path: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let current: string[] = [];
  for await (const line of rl) {
    if (SEPARATOR.test(line)) {
      if (current.length > 0) yield current.join("\n");
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) yield current.join("\n");
}

function sqlString(value: string | null): string {
  return value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

interface Candidate {
  messageId: string;
  date: string; // YYYY-MM-DD
  dateMs: number;
  text: string;
  meditationTitle: string | null;
  meditationLinkHref: string | null;
  meditationUrl: string | null;
  needsReview: boolean;
  reviewReason: ReviewReason | null;
}

async function main() {
  const mboxPath = process.argv[2];
  if (!mboxPath) {
    console.error("Usage: npx tsx scripts/import-mbox.ts <path-to-mbox>");
    process.exit(1);
  }

  const candidates: Candidate[] = [];
  let total = 0;
  let skippedNotNana = 0;
  let skippedNoDate = 0;
  let skippedNoMessageId = 0;

  for await (const raw of splitMbox(mboxPath)) {
    total++;
    const parsed = await simpleParser(raw);
    const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase();
    if (fromAddress !== NANA_ADDRESS) {
      skippedNotNana++;
      continue;
    }
    if (!parsed.date) {
      skippedNoDate++;
      continue;
    }
    const messageId = parsed.messageId;
    if (!messageId) {
      skippedNoMessageId++;
      continue;
    }

    // Same date-derivation rule as the live path (worker/ingestion/gmail.ts):
    // the message's own Date header, in UTC — never the subject or body.
    const rawMessage: RawMessage = {
      gmailMessageId: messageId,
      date: parsed.date.toISOString().slice(0, 10),
      subject: parsed.subject ?? "",
      plainTextBody: parsed.text ?? null,
      htmlBody: typeof parsed.html === "string" ? parsed.html : null,
    };

    const extracted = extractLetter(rawMessage);
    candidates.push({
      messageId,
      date: extracted.date,
      dateMs: parsed.date.getTime(),
      text: extracted.text,
      meditationTitle: extracted.meditationTitle,
      meditationLinkHref: extracted.meditationLinkHref,
      meditationUrl: null,
      needsReview: extracted.needsReview,
      reviewReason: extracted.reviewReason,
    });

    if (total % 200 === 0) console.log(`...scanned ${total} messages`);
  }

  console.log(`\nTotal messages in mbox: ${total}`);
  console.log(`Skipped (not from Nana — another family member's reply in-thread): ${skippedNotNana}`);
  console.log(`Skipped (no Date header): ${skippedNoDate}`);
  console.log(`Skipped (no Message-ID): ${skippedNoMessageId}`);
  console.log(`Candidate letters from Nana: ${candidates.length}`);

  // Chronological order so "first one wins" for same-day dedup, matching the
  // live ingestion's same-day duplicate handling (worker/ingestion/sync.ts).
  candidates.sort((a, b) => a.dateMs - b.dateMs);

  const accepted: Candidate[] = [];
  const reviewItems: { messageId: string; reason: ReviewReason; date: string; text: string }[] = [];
  const acceptedByDate = new Map<string, Candidate>();

  for (const c of candidates) {
    if (c.needsReview) {
      reviewItems.push({ messageId: c.messageId, reason: c.reviewReason ?? "no_forward_marker", date: c.date, text: c.text });
      continue;
    }
    const existing = acceptedByDate.get(c.date);
    if (existing) {
      if (isSameLetter(existing.text, c.text)) continue; // exact resend, silently merge
      reviewItems.push({ messageId: c.messageId, reason: "ambiguous_duplicate", date: c.date, text: c.text });
      continue;
    }
    acceptedByDate.set(c.date, c);
    accepted.push(c);
  }

  console.log(`Accepted letters: ${accepted.length}`);
  console.log(`Flagged for review: ${reviewItems.length}`);

  // Resolve meditation links with a small concurrency cap. A one-off local
  // run has no CPU-time limit to worry about (unlike the Cron Trigger), but
  // being polite to cac.org's servers still matters.
  const CONCURRENCY = 5;
  let nextIndex = 0;
  let resolved = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (nextIndex < accepted.length) {
        const c = accepted[nextIndex++];
        c.meditationUrl = c.meditationLinkHref ? await resolveMeditationUrl(c.meditationLinkHref) : null;
        resolved++;
        if (resolved % 100 === 0) console.log(`...resolved ${resolved}/${accepted.length} meditation links`);
      }
    }),
  );

  const lines: string[] = [
    "-- Generated by scripts/import-mbox.ts from the Google Takeout export.",
    "-- Idempotent (ON CONFLICT DO NOTHING on the same unique message id) — safe to re-run.",
    "-- Review before running against prod. Never commit this file or its input.",
  ];
  for (const c of accepted) {
    lines.push(
      `INSERT INTO letters (date, text, meditation_title, meditation_url, gmail_message_id) VALUES (${sqlString(c.date)}, ${sqlString(c.text)}, ${sqlString(c.meditationTitle)}, ${sqlString(c.meditationUrl)}, ${sqlString(c.messageId)}) ON CONFLICT (gmail_message_id) DO NOTHING;`,
    );
  }
  for (const r of reviewItems) {
    lines.push(
      `INSERT INTO review_queue (gmail_message_id, reason, received_date, raw_text) VALUES (${sqlString(r.messageId)}, ${sqlString(r.reason)}, ${sqlString(r.date)}, ${sqlString(r.text)}) ON CONFLICT (gmail_message_id) DO NOTHING;`,
    );
  }

  mkdirSync("backfill", { recursive: true });
  const outPath = "backfill/import.sql";
  writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`\nWrote ${outPath}: ${accepted.length} letters, ${reviewItems.length} review items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
