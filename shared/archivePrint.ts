// The printable HTML for one year's PDF (scripts/lib/pdf.ts hands it to a
// headless browser). A bound-book layout: title page, contents, then each
// month's letters in order. Letters flow continuously and avoid splitting
// across pages where they can, since most are shorter than a page.

import type { ArchiveLetter } from "./archive";
import { escapeHtml, groupByYearMonth, longDate, MONTH_NAMES, paragraphsHtml } from "./archiveMarkup";

const CSS = `
@page { size: Letter; margin: 0.9in 1in; }
body { font-family: "Source Serif 4", Georgia, "Times New Roman", serif; color: #2b241c; font-size: 11.5pt; line-height: 1.5; }
.title { height: 8.5in; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
.title .year { font-size: 72pt; color: #b0522d; line-height: 1; margin: 0; }
.title h1 { font-weight: normal; font-size: 22pt; margin: 0.2em 0; }
.title p { color: #6b5f4f; margin: 0; }
.toc { page-break-after: always; }
.toc h2 { font-weight: normal; }
.toc li { margin: 0.3em 0; }
h2.month { font-weight: normal; font-size: 20pt; color: #b0522d; margin: 1.2em 0 0.4em; border-bottom: 1px solid #e4dacb; page-break-after: avoid; }
.letter { margin: 0 0 1.4em; }
.letter h3 { font-size: 12.5pt; margin: 0 0 0.2em; page-break-after: avoid; }
.meditation { font-size: 9.5pt; color: #6b5f4f; margin: 0 0 0.6em; }
.letter p { margin: 0 0 0.5em; }
.letter img { max-width: 100%; max-height: 4in; display: block; margin: 0.6em 0; }
.comments { font-size: 10pt; border-left: 2px solid #e4dacb; padding-left: 0.8em; margin-top: 0.8em; }
.comments .by { color: #6b5f4f; margin: 0; }
`;

function letterBlock(letter: ArchiveLetter): string {
  const parts = [`<h3>${escapeHtml(longDate(letter.date))}</h3>`];
  if (letter.meditationTitle) {
    parts.push(`<p class="meditation">Meditation that day: ${escapeHtml(letter.meditationTitle)}</p>`);
  }
  parts.push(paragraphsHtml(letter.text));
  for (const p of letter.photos) {
    parts.push(`<img src="${escapeHtml(p.file)}" alt="${escapeHtml(p.caption ?? "Photo")}"/>`);
  }
  if (letter.comments.length > 0) {
    parts.push(
      `<div class="comments">${letter.comments
        .map(
          (c) =>
            `<p class="by"><em>${escapeHtml(c.authorName?.trim() || "A family member")}, ${escapeHtml(c.day)}</em></p>${paragraphsHtml(c.body)}`,
        )
        .join("")}</div>`,
    );
  }
  return `<section class="letter">\n${parts.join("\n")}\n</section>`;
}

/** `letters` must all fall in `year`, oldest first. Photo srcs are archive-relative; write the page at the archive root. */
export function buildYearPrintHtml(year: number, letters: ArchiveLetter[]): string {
  const months = groupByYearMonth(letters)[0]?.months ?? [];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Nana's Letters, ${year}</title>
<style>${CSS}</style>
</head>
<body>
<section class="title">
<p class="year">${year}</p>
<h1>Nana's Letters</h1>
<p>${letters.length} letters to the family</p>
</section>
<section class="toc">
<h2>Contents</h2>
<ul>
${months.map((m) => `<li>${MONTH_NAMES[m.month - 1]} (${m.letters.length})</li>`).join("\n")}
</ul>
</section>
${months
  .map((m) => `<h2 class="month">${MONTH_NAMES[m.month - 1]} ${year}</h2>\n${m.letters.map(letterBlock).join("\n")}`)
  .join("\n")}
</body>
</html>
`;
}
