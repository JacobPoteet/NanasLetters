// Fallback link for a letter whose meditation CTA link never resolved to a
// real cac.org URL (older-format emails with no CTA at all, or a HEAD
// resolution that failed at ingestion time — see
// worker/ingestion/meditationLink.ts). Never guesses at the specific
// article: cac.org's slugs aren't a clean function of the date or title
// (see that file's comment on "radical-resilience"), so this points at
// cac.org's own search results for the letter's date instead — one extra
// click for the family member, but never a wrong page.
//
// Confirmed against the live site: cac.org runs on WordPress and its plain
// "?s=" search surfaces the date-disambiguated daily-meditation slug (e.g.
// "a-church-on-the-margins-2020-09-28") as a top result for a full
// "Month Day, Year" query.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function meditationSearchUrl(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const formatted = `${MONTHS[month - 1]} ${day}, ${year}`;
  const params = new URLSearchParams({ s: formatted });
  return `https://cac.org/?${params.toString()}`;
}
