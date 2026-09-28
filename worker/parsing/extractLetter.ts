// Splits a raw Gmail message into "Nana's own words" and everything else.
//
// Findings this leans on, from the parsing experiment (see CLAUDE.md):
//   - The forward marker text itself has changed over the years
//     ("-----Original Message-----" in 2018 vs "----- Forwarded Message -----"
//     by 2023+), and some letters are a forward of a forward. So this matches
//     against a growable list of known markers rather than one fixed string,
//     and takes the EARLIEST match — everything above it is hers.
//   - Some recent messages have no genuine text/plain MIME part, so the HTML
//     body has to go through htmlToText first (which is also what strips the
//     CSS-junk bug found in a Sept 2026 sample).
//   - The letter's date comes from the message's own Date header, passed in
//     already resolved — never parsed from the subject or body here.

import type { ReviewReason } from "../../shared/types";
import { htmlToText } from "./htmlToText";

export interface RawMessage {
  gmailMessageId: string;
  /** The message's own Date header, already resolved to YYYY-MM-DD by the caller. */
  date: string;
  subject: string;
  /** A genuine text/plain MIME part, if Gmail's API reports one. */
  plainTextBody: string | null;
  /** The text/html MIME part, if present. */
  htmlBody: string | null;
}

export interface ExtractedLetter {
  gmailMessageId: string;
  date: string;
  text: string;
  meditationTitle: string | null;
  /**
   * The CTA link's raw href, if one was found — an `email.cac.org/t/...`
   * tracking redirect, NOT a page to link to directly (see the comment on
   * `findMeditationLinkHref` below). The ingestion orchestrator resolves this
   * to a real cac.org URL before it's ever stored; extractLetter stays pure
   * and does no network I/O.
   */
  meditationLinkHref: string | null;
  needsReview: boolean;
  reviewReason: ReviewReason | null;
}

// Ordered oldest-format-first for readability only; all are checked and the
// EARLIEST match in the text wins, regardless of list order.
const FORWARD_MARKERS: RegExp[] = [
  /-{2,}\s*original message\s*-{2,}/i,
  /-{2,}\s*forwarded message\s*-{2,}/i,
  /^begin forwarded message:/im,
  /^from:\s*center for action and contemplation/im,
];

function findForwardBoundary(text: string): number | null {
  let earliest: number | null = null;
  for (const marker of FORWARD_MARKERS) {
    const match = marker.exec(text);
    if (match && (earliest === null || match.index < earliest)) {
      earliest = match.index;
    }
  }
  return earliest;
}

// Matches both eras' subject shapes: "Fwd: Richard Rohr Meditation: X" (2018)
// and "Fw: Richard Rohr's Daily Meditation: X" (2023+).
const MEDITATION_SUBJECT = /^f(?:w|wd):\s*richard rohr'?s?\s+(?:daily\s+)?meditations?:\s*(.+)$/i;

function parseMeditationTitle(subject: string): { title: string | null; unexpectedSubject: boolean } {
  const match = MEDITATION_SUBJECT.exec(subject.trim());
  if (!match) return { title: null, unexpectedSubject: true };
  return { title: match[1].trim(), unexpectedSubject: false };
}

const ANCHOR = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
// Matches both CTA wordings seen so far: "READ ON CAC.ORG" (2026) and "Read
// this meditation on cac.org." (2023). Every link in these newsletters is
// wrapped in the same email.cac.org tracking redirect regardless of
// destination, so the anchor's VISIBLE TEXT is what has to identify the
// right one — the href alone can't distinguish "read the meditation" from
// "unsubscribe".
const MEDITATION_LINK_TEXT = /read[\s\S]*cac\.org/i;

/**
 * Finds the "read the full meditation" link in the raw HTML, if the
 * newsletter template for that era included one (2018-era emails embedded
 * the whole meditation inline and had no such link — that's expected, not a
 * parsing failure). Returns the raw tracking-redirect href, never a page to
 * link a family member to directly: it's a per-recipient link tied to
 * Nana's own subscription, and Cloudflare Workers-side resolution to the
 * real cac.org URL happens elsewhere, once, at ingestion time.
 */
export function findMeditationLinkHref(html: string | null): string | null {
  if (!html) return null;
  ANCHOR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR.exec(html))) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (MEDITATION_LINK_TEXT.test(text)) return match[1];
  }
  return null;
}

export function extractLetter(message: RawMessage): ExtractedLetter {
  const rawText = message.plainTextBody ?? (message.htmlBody ? htmlToText(message.htmlBody) : "");
  const boundary = findForwardBoundary(rawText);
  const { title, unexpectedSubject } = parseMeditationTitle(message.subject);

  const noForwardMarker = boundary === null;
  const text = (noForwardMarker ? rawText : rawText.slice(0, boundary)).trim();

  // No-forward-marker is the more serious problem (it means we can't be sure
  // where her words end), so it wins when a message has both issues.
  const reviewReason: ReviewReason | null = noForwardMarker
    ? "no_forward_marker"
    : unexpectedSubject
      ? "unexpected_subject"
      : null;

  return {
    gmailMessageId: message.gmailMessageId,
    date: message.date,
    text,
    meditationTitle: title,
    meditationLinkHref: findMeditationLinkHref(message.htmlBody),
    needsReview: reviewReason !== null,
    reviewReason,
  };
}
