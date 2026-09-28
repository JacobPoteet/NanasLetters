// The Cron Trigger's ingestion handler — backfill and ongoing letters share
// this exact code path (see CLAUDE.md's Tech stack decision), so there is
// only ever one parsing pipeline to trust. A first run has no cursor and
// pages through the entire label history; every run after that only asks
// Gmail for messages after the last synced date.

import { extractLetter } from "../parsing/extractLetter";
import { fetchMessage, getAccessToken, listMessageIds } from "./gmail";
import { isSameLetter } from "./duplicate";
import { resolveMeditationUrl } from "./meditationLink";
import { shiftDate } from "../dateWindow";
import {
  getIngestionState,
  getLetterTextByDate,
  insertLetter,
  insertReviewItem,
  letterExists,
  setIngestionState,
} from "../db";

const CURSOR_KEY = "last_synced_date";

export interface SyncResult {
  processed: number;
  inserted: number;
  flaggedForReview: number;
  skippedDuplicates: number;
  /** True when ingestion didn't run at all because it's not configured yet. */
  skipped?: boolean;
}

const EMPTY_RESULT: SyncResult = { processed: 0, inserted: 0, flaggedForReview: 0, skippedDuplicates: 0 };

export async function runIngestion(env: Env): Promise<SyncResult> {
  // Ongoing ingestion is deliberately on hold (see CLAUDE.md's #6) until a
  // Gmail OAuth refresh token is minted. Without this, every daily run would
  // otherwise hit Google's token endpoint with empty credentials and throw
  // -- a misleading "ingestion run FAILED" every night for a known,
  // intentional state, not an actual incident.
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    return { ...EMPTY_RESULT, skipped: true };
  }

  const accessToken = await getAccessToken(env);
  const cursor = await getIngestionState(env.DB, CURSOR_KEY);
  // One day of overlap on every run: cheap, and letterExists() below makes
  // reprocessing an already-ingested message a no-op rather than a duplicate.
  const afterDate = cursor ? shiftDate(cursor, -1) : null;

  const ids = await listMessageIds(accessToken, afterDate);

  const result: SyncResult = { processed: 0, inserted: 0, flaggedForReview: 0, skippedDuplicates: 0 };

  for (const id of ids) {
    if (await letterExists(env.DB, id)) continue;

    const raw = await fetchMessage(accessToken, id);
    const extracted = extractLetter(raw);
    result.processed++;

    if (extracted.needsReview) {
      await insertReviewItem(env.DB, {
        gmailMessageId: extracted.gmailMessageId,
        reason: extracted.reviewReason ?? "no_forward_marker",
        receivedDate: extracted.date,
        rawText: extracted.text,
      });
      result.flaggedForReview++;
      continue;
    }

    const existingText = await getLetterTextByDate(env.DB, extracted.date);
    if (existingText !== null) {
      if (isSameLetter(existingText, extracted.text)) {
        result.skippedDuplicates++;
      } else {
        await insertReviewItem(env.DB, {
          gmailMessageId: extracted.gmailMessageId,
          reason: "ambiguous_duplicate",
          receivedDate: extracted.date,
          rawText: extracted.text,
        });
        result.flaggedForReview++;
      }
      continue;
    }

    // Resolved once, here, never re-visited: see meditationLink.ts for why
    // this can't just be constructed from the title. A resolution failure
    // (the newsletter had no such link, or the fetch errored) isn't a reason
    // to fail the whole letter — it just means no reference link this time.
    const meditationUrl = extracted.meditationLinkHref
      ? await resolveMeditationUrl(extracted.meditationLinkHref)
      : null;

    await insertLetter(env.DB, {
      gmailMessageId: extracted.gmailMessageId,
      date: extracted.date,
      text: extracted.text,
      meditationTitle: extracted.meditationTitle,
      meditationUrl,
    });
    result.inserted++;
  }

  await setIngestionState(env.DB, CURSOR_KEY, new Date().toISOString().slice(0, 10));
  return result;
}
