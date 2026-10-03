// One EPUB 3 per year: pure fold from a year's letters to the book's text
// files. Photo bytes aren't known here, so the result also lists each photo
// the script must add under OEBPS/photos/.

import type { ArchiveLetter } from "./archive";
import { escapeHtml, longDate, MONTH_NAMES, paragraphsHtml, groupByYearMonth } from "./archiveMarkup";

export interface EpubFile {
  path: string;
  content: string;
}

export interface EpubBook {
  /** Text entries, `mimetype` first — zip them in this order. */
  files: EpubFile[];
  /** Archive-relative photo path -> path inside the EPUB. */
  photos: { from: string; to: string; mimeType: string }[];
}

const CSS = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1, h2 { font-weight: normal; }
h1 { text-align: center; margin-top: 3em; }
h2 { border-bottom: 1px solid #c9bfae; padding-bottom: 0.2em; margin-top: 2em; }
.meditation { font-size: 0.85em; color: #6b5f4f; margin: 0 0 1em; }
.comments { font-size: 0.9em; border-top: 1px solid #e4dacb; margin-top: 1em; padding-top: 0.5em; }
.comment-by { color: #6b5f4f; margin-bottom: 0; }
img { max-width: 100%; }
.cover { text-align: center; }
`;

function xhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`;
}

function photoPath(letter: ArchiveLetter, index: number): string {
  const base = letter.photos[index].file.split("/").pop() ?? `photo-${letter.id}-${index}`;
  return `photos/${base}`;
}

function letterHtml(letter: ArchiveLetter): string {
  const parts = [`<h2>${escapeHtml(longDate(letter.date))}</h2>`];
  if (letter.meditationTitle) {
    parts.push(`<p class="meditation">Meditation that day: ${escapeHtml(letter.meditationTitle)}</p>`);
  }
  parts.push(paragraphsHtml(letter.text));
  letter.photos.forEach((p, i) => {
    parts.push(`<p><img src="${escapeHtml(photoPath(letter, i))}" alt="${escapeHtml(p.caption ?? "Photo")}"/></p>`);
  });
  if (letter.comments.length > 0) {
    const blocks = letter.comments.map(
      (c) =>
        `<p class="comment-by"><em>${escapeHtml(c.authorName?.trim() || "A family member")}, ${escapeHtml(c.createdAt.slice(0, 10))}</em></p>\n${paragraphsHtml(c.body)}`,
    );
    parts.push(`<div class="comments">\n${blocks.join("\n")}\n</div>`);
  }
  return parts.join("\n");
}

/** `letters` must all fall in `year`, oldest first. */
export function buildYearEpub(year: number, letters: ArchiveLetter[], generatedAt: string): EpubBook {
  const title = `Nana's Letters, ${year}`;
  const months = groupByYearMonth(letters)[0]?.months ?? [];
  const chapter = (month: number) => `month-${String(month).padStart(2, "0")}.xhtml`;

  const photos = letters.flatMap((l) =>
    l.photos.map((p, i) => ({ from: p.file, to: `OEBPS/${photoPath(l, i)}`, mimeType: p.mimeType })),
  );

  const files: EpubFile[] = [
    { path: "mimetype", content: "application/epub+zip" },
    {
      path: "META-INF/container.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`,
    },
    { path: "OEBPS/style.css", content: CSS },
    {
      path: "OEBPS/title.xhtml",
      content: xhtml(
        title,
        `<div class="cover"><h1>${escapeHtml(title)}</h1><p>${letters.length} letters from Nana to the family</p></div>`,
      ),
    },
    {
      path: "OEBPS/nav.xhtml",
      content: xhtml(
        title,
        `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>\n${months
          .map((m) => `<li><a href="${chapter(m.month)}">${MONTH_NAMES[m.month - 1]}</a></li>`)
          .join("\n")}\n</ol></nav>`,
      ),
    },
    ...months.map((m) => ({
      path: `OEBPS/${chapter(m.month)}`,
      content: xhtml(
        `${MONTH_NAMES[m.month - 1]} ${year}`,
        `<h1>${MONTH_NAMES[m.month - 1]} ${year}</h1>\n${m.letters.map(letterHtml).join("\n")}`,
      ),
    })),
  ];

  const photoManifest = photos.map(
    (p, i) => `<item id="photo-${i}" href="${escapeHtml(p.to.replace("OEBPS/", ""))}" media-type="${escapeHtml(p.mimeType)}"/>`,
  );
  const monthManifest = months.map((m) => `<item id="m${m.month}" href="${chapter(m.month)}" media-type="application/xhtml+xml"/>`);
  const spine = ["title", ...months.map((m) => `m${m.month}`)].map((id) => `<itemref idref="${id}"/>`);

  files.splice(3, 0, {
    path: "OEBPS/content.opf",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:nanas-letters:${year}</dc:identifier>
<dc:title>${escapeHtml(title)}</dc:title>
<dc:creator>Nana</dc:creator>
<dc:language>en</dc:language>
<meta property="dcterms:modified">${generatedAt.replace(/\.\d+Z$/, "Z")}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${[...monthManifest, ...photoManifest].join("\n")}
</manifest>
<spine>
${spine.join("\n")}
</spine>
</package>
`,
  });

  return { files, photos };
}
