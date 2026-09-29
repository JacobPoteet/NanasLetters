// Fallback link for a letter whose meditation CTA link never resolved to a
// real cac.org URL (older-format emails with no CTA at all, or a HEAD
// resolution that failed at ingestion time — see
// worker/ingestion/meditationLink.ts). Never guesses at the specific
// article: cac.org's slugs aren't a clean function of the date or title
// (see that file's comment on "radical-resilience"), so this points at
// cac.org's own date-based daily-meditations archive page instead — the
// one post published that day, not a guessed slug.
//
// Confirmed against the live site: cac.org's WordPress date archive at
// /category/daily-meditations/YYYY/MM/DD/ lists exactly that day's
// meditation. A plain "?s=" search was tried first but returns a noisy
// results page (other pages mentioning that date) rather than landing
// straight on the post.

export function meditationArchiveUrl(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `https://cac.org/category/daily-meditations/${year}/${month}/${day}/`;
}
