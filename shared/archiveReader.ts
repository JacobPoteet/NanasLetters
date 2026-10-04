// Page shell and data file for the offline reader (index.html). The reader
// must open straight from a USB stick via file://, where browsers block
// fetch() and module scripts — so the data ships as a classic <script> that
// assigns window.ARCHIVE, and the app code is one bundled classic script.

import { letterKey, type ArchiveLetter } from "./archive";
import { escapeHtml } from "./archiveMarkup";

export interface ReaderLetter {
  key: string;
  date: string;
  text: string;
  meditationTitle: string | null;
  meditationUrl: string | null;
  photos: { file: string; caption: string | null }[];
  comments: { authorName: string | null; body: string; createdAt: string; day: string }[];
}

export function buildReaderDataJs(letters: ArchiveLetter[], generatedAt: string): string {
  const data = {
    generatedAt,
    letters: letters.map(
      (l): ReaderLetter => ({
        key: letterKey(l),
        date: l.date,
        text: l.text,
        meditationTitle: l.meditationTitle,
        meditationUrl: l.meditationUrl,
        photos: l.photos.map((p) => ({ file: p.file, caption: p.caption })),
        comments: l.comments,
      }),
    ),
  };
  // U+2028/2029 were illegal in JS string literals before ES2019; escape them
  // so the file parses in an older browser someone digs out years from now.
  const json = JSON.stringify(data).split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
  return `window.ARCHIVE = ${json};\n`;
}

export function buildReaderHtml(opts: { letterCount: number; firstDate: string; lastDate: string }): string {
  const summary = `${opts.letterCount} letters, ${opts.firstDate} to ${opts.lastDate}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>The Daily - Nana's Letters archive</title>
<link rel="stylesheet" href="reader/reader.css"/>
</head>
<body>
<header class="masthead">
<a class="brand" href="#/">The Daily</a>
<nav aria-label="Main">
<a href="#/">On this day</a>
<a href="#/browse">Browse</a>
<a href="#/search">Search</a>
</nav>
</header>
<main id="app"><noscript>This archive needs JavaScript. The plain-text copies are in the letters folder.</noscript></main>
<footer class="foot">${escapeHtml(summary)}. A private family archive; please do not post it publicly.</footer>
<script src="reader/data.js"></script>
<script src="reader/reader.js"></script>
</body>
</html>
`;
}
