import { describe, expect, it } from "vitest";
import { buildReadme, letterKey, type ArchiveLetter } from "./archive";
import { buildYearEpub } from "./archiveEpub";
import { buildYearPrintHtml } from "./archivePrint";
import { buildReaderDataJs, buildReaderHtml } from "./archiveReader";

const letter = (date: string, extra: Partial<ArchiveLetter> = {}): ArchiveLetter => ({
  id: 1,
  date,
  text: "Good morning <family> & friends.\nSecond line.",
  meditationTitle: "An Influential Teacher",
  meditationUrl: null,
  photos: [],
  comments: [],
  file: `letters/${date}.txt`,
  ...extra,
});

const withPhotoAndComment = letter("2023-12-24", {
  photos: [{ r2Key: "k", mimeType: "image/jpeg", caption: 'The "tree"', file: "photos/2023-12-24-1.jpg" }],
  comments: [{ authorName: null, body: "Love it", createdAt: "2023-12-25 13:00:00", day: "2023-12-25" }],
});

describe("buildYearEpub", () => {
  const book = buildYearEpub(2023, [withPhotoAndComment, letter("2023-12-25"), letter("2023-01-02")].sort((a, b) => a.date.localeCompare(b.date)), "2026-10-03T12:00:00.123Z");
  const file = (path: string) => book.files.find((f) => f.path === path)?.content ?? "";

  it("puts mimetype first, with the exact EPUB value", () => {
    expect(book.files[0]).toEqual({ path: "mimetype", content: "application/epub+zip" });
  });
  it("has one chapter per month present, and a nav entry for each", () => {
    expect(book.files.map((f) => f.path).filter((p) => p.includes("month-"))).toEqual(["OEBPS/month-01.xhtml", "OEBPS/month-12.xhtml"]);
    expect(file("OEBPS/nav.xhtml")).toContain('href="month-12.xhtml">December');
  });
  it("lists every chapter and photo in the manifest and the chapters in the spine", () => {
    const opf = file("OEBPS/content.opf");
    expect(opf).toContain('href="month-01.xhtml"');
    expect(opf).toContain('href="photos/2023-12-24-1.jpg" media-type="image/jpeg"');
    expect(opf).toContain('<itemref idref="m12"/>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-10-03T12:00:00Z</meta>');
  });
  it("escapes letter text and attributes", () => {
    const dec = file("OEBPS/month-12.xhtml");
    expect(dec).toContain("Good morning &lt;family&gt; &amp; friends.");
    expect(dec).toContain('alt="The &quot;tree&quot;"');
    expect(dec).toContain("A family member, 2023-12-25");
  });
  it("reports photos to bundle", () => {
    expect(book.photos).toEqual([{ from: "photos/2023-12-24-1.jpg", to: "OEBPS/photos/2023-12-24-1.jpg", mimeType: "image/jpeg" }]);
  });
});

describe("buildYearPrintHtml", () => {
  const html = buildYearPrintHtml(2023, [letter("2023-01-02"), withPhotoAndComment]);
  it("has a title page, contents, and month headings", () => {
    expect(html).toContain('<p class="year">2023</p>');
    expect(html).toContain("<li>January (1)</li>");
    expect(html).toContain('<h2 class="month">December 2023</h2>');
  });
  it("escapes text and references photos by archive-relative path", () => {
    expect(html).toContain("Good morning &lt;family&gt;");
    expect(html).toContain('src="photos/2023-12-24-1.jpg"');
  });
});

describe("reader builders", () => {
  it("derives the route key from the text file name", () => {
    expect(letterKey({ file: "letters/2020-01-01-2.txt" })).toBe("2020-01-01-2");
  });
  it("emits data as a classic script that parses back, with line separators escaped", () => {
    const js = buildReaderDataJs([letter("2020-01-01", { text: "a b" })], "t");
    expect(js.startsWith("window.ARCHIVE = ")).toBe(true);
    expect(js).not.toContain(" ");
    const window = {} as { ARCHIVE?: { letters: { key: string; text: string }[] } };
    new Function("window", js)(window);
    expect(window.ARCHIVE?.letters[0]).toMatchObject({ key: "2020-01-01", text: "a b" });
  });
  it("references only relative assets in the page shell", () => {
    const html = buildReaderHtml({ letterCount: 3, firstDate: "2018-02-06", lastDate: "2026-09-27" });
    expect(html).toContain('href="reader/reader.css"');
    expect(html).toContain('src="reader/data.js"');
    expect(html).not.toMatch(/(?:src|href)="https?:/);
  });
});

describe("buildReadme formats", () => {
  const base = { generatedAt: "x", letterCount: 1, firstDate: "a", lastDate: "b", commentCount: 0, photoCount: 0 };
  it("mentions PDFs only when they were written", () => {
    expect(buildReadme({ ...base, hasPdf: true })).toContain("pdf/");
    expect(buildReadme({ ...base, hasPdf: false })).not.toContain("pdf/");
  });
});
