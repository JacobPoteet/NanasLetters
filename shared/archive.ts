// Pure folds behind `npm run archive` (scripts/archive.ts): rows in, file
// contents out. Kept apart from the script so every format decision is unit
// tested without touching Wrangler, R2, or the disk.

export interface ArchiveComment {
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface ArchivePhoto {
  r2Key: string;
  mimeType: string;
  caption: string | null;
  /** Path inside the archive, e.g. photos/2023-12-24-1.jpg. */
  file: string;
}

export interface ArchiveLetter {
  id: number;
  date: string;
  text: string;
  meditationTitle: string | null;
  meditationUrl: string | null;
  photos: ArchivePhoto[];
  comments: ArchiveComment[];
  /** Path inside the archive, e.g. letters/2023-12-24.txt. */
  file: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
};

export function photoExtension(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType.toLowerCase()] ?? "bin";
}

/**
 * Letters are named by date so the folder sorts chronologically in any file
 * browser. Two letters on one date (an admin kept both) get -2, -3 suffixes in
 * id order rather than overwriting each other.
 */
export function assignFileNames<T extends { id: number; date: string }>(letters: T[]): (T & { file: string })[] {
  const sorted = [...letters].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const seen = new Map<string, number>();
  return sorted.map((letter) => {
    const n = (seen.get(letter.date) ?? 0) + 1;
    seen.set(letter.date, n);
    return { ...letter, file: `letters/${letter.date}${n === 1 ? "" : `-${n}`}.txt` };
  });
}

export function photoFileName(date: string, index: number, mimeType: string): string {
  return `photos/${date}-${index + 1}.${photoExtension(mimeType)}`;
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function commentBlock(c: ArchiveComment): string {
  const who = c.authorName?.trim() || "A family member";
  return `${who}, ${c.createdAt.slice(0, 10)}:\n${c.body.trim()}`;
}

/** One letter as a standalone, human-readable text file. */
export function formatLetterText(letter: ArchiveLetter): string {
  const heading = longDate(letter.date);
  const parts = [heading, "=".repeat(heading.length), ""];
  if (letter.meditationTitle) {
    parts.push(`Meditation that day: ${letter.meditationTitle}`);
    if (letter.meditationUrl) parts.push(letter.meditationUrl);
    parts.push("");
  }
  parts.push(letter.text.trim(), "");
  for (const photo of letter.photos) {
    parts.push(`[Photo: ${photo.file}${photo.caption ? ` - ${photo.caption}` : ""}]`);
  }
  if (letter.photos.length > 0) parts.push("");
  if (letter.comments.length > 0) {
    parts.push("--- Comments ---", "", letter.comments.map(commentBlock).join("\n\n"), "");
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

/** Every letter in one greppable file, oldest first. */
export function formatAllLettersText(letters: ArchiveLetter[]): string {
  const divider = `\n\n${"-".repeat(72)}\n\n`;
  return `${letters.map((l) => formatLetterText(l).trimEnd()).join(divider)}\n`;
}

/** The machine-readable master: stable field names, no internal device/IP data. */
export function buildArchiveJson(letters: ArchiveLetter[], generatedAt: string): string {
  return `${JSON.stringify(
    {
      generatedAt,
      letterCount: letters.length,
      letters: letters.map((l) => ({
        date: l.date,
        text: l.text,
        meditationTitle: l.meditationTitle,
        meditationUrl: l.meditationUrl,
        file: l.file,
        photos: l.photos.map((p) => ({ file: p.file, mimeType: p.mimeType, caption: p.caption })),
        comments: l.comments,
      })),
    },
    null,
    2,
  )}\n`;
}

/** sha256sum-compatible manifest: `<hash>  <path>`, verifiable with `sha256sum -c`. */
export function formatChecksums(entries: { path: string; sha256: string }[]): string {
  return `${[...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((e) => `${e.sha256}  ${e.path}`)
    .join("\n")}\n`;
}

export function buildReadme(opts: {
  generatedAt: string;
  letterCount: number;
  firstDate: string;
  lastDate: string;
  commentCount: number;
  photoCount: number;
  hasPdf: boolean;
}): string {
  return `Nana's Letters - archive
=========================

Generated ${opts.generatedAt}.
${opts.letterCount} letters, ${opts.firstDate} through ${opts.lastDate}, with ${opts.commentCount} family comments and ${opts.photoCount} photos.

Since February 2018, Nana has written a morning email to the family. This
folder is a copy of every letter, readable without the website or any special
software.

What is here
------------
index.html          Start here. Open it in any web browser: no internet, no
                    login. On this day, browse by year, and search the words.
epub/               One e-book per year, for a phone, tablet or e-reader.
${opts.hasPdf ? "pdf/                One PDF per year, laid out like a book, for printing.\n" : ""}letters/            One plain-text file per letter, named by date. Open with
                    any text editor.
all-letters.txt     Every letter in one file, oldest first. Handy for searching.
reader/             The pieces index.html needs. Leave this folder next to it.
photos/             Photos attached to letters, named by letter date.
data/letters.json   The same content as structured data (UTF-8 JSON), for
                    anyone who wants to build something from it.
checksums.sha256    A fingerprint of every file here. To confirm nothing has
                    been damaged, run "sha256sum -c checksums.sha256" in this
                    folder (Mac/Linux, or Git Bash on Windows).

What is not here
----------------
Only Nana's own words are kept. Each day's meditation arrives as a forwarded
newsletter from the Center for Action and Contemplation; its text is not
copied here, only its title and a link when one was found.

Privacy
-------
This archive contains private family writing. Keep it on drives you trust,
and do not post it publicly.
`;
}
