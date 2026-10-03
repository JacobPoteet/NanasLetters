import { describe, expect, it } from "vitest";
import {
  assignFileNames,
  buildArchiveJson,
  buildReadme,
  formatAllLettersText,
  formatChecksums,
  formatLetterText,
  photoExtension,
  photoFileName,
  type ArchiveLetter,
} from "./archive";

const letter: ArchiveLetter = {
  id: 1,
  date: "2023-12-24",
  text: "  Good morning, family.\nIt snowed.  ",
  meditationTitle: "An Influential Teacher",
  meditationUrl: "https://cac.org/daily-meditations/an-influential-teacher/",
  photos: [{ r2Key: "k", mimeType: "image/jpeg", caption: "The tree", file: "photos/2023-12-24-1.jpg" }],
  comments: [
    { authorName: "Jacob", body: "Love this.\n", createdAt: "2023-12-25 08:00:00" },
    { authorName: null, body: "Merry Christmas", createdAt: "2023-12-25 09:00:00" },
  ],
  file: "letters/2023-12-24.txt",
};

describe("assignFileNames", () => {
  it("sorts by date and suffixes same-day letters in id order", () => {
    const named = assignFileNames([
      { id: 3, date: "2020-01-02" },
      { id: 9, date: "2020-01-01" },
      { id: 2, date: "2020-01-01" },
    ]);
    expect(named.map((l) => [l.id, l.file])).toEqual([
      [2, "letters/2020-01-01.txt"],
      [9, "letters/2020-01-01-2.txt"],
      [3, "letters/2020-01-02.txt"],
    ]);
  });
});

describe("photos", () => {
  it("maps mime types to extensions, falling back to bin", () => {
    expect(photoExtension("image/JPEG")).toBe("jpg");
    expect(photoExtension("application/x-weird")).toBe("bin");
  });
  it("names photos by date and 1-based index", () => {
    expect(photoFileName("2023-12-24", 1, "image/png")).toBe("photos/2023-12-24-2.png");
  });
});

describe("formatLetterText", () => {
  const out = formatLetterText(letter);
  it("leads with the long date and meditation reference", () => {
    expect(out.startsWith("Sunday, December 24, 2023\n=========================\n")).toBe(true);
    expect(out).toContain("Meditation that day: An Influential Teacher\nhttps://cac.org/");
  });
  it("trims the body, lists photos, and appends comments", () => {
    expect(out).toContain("\nGood morning, family.\nIt snowed.\n");
    expect(out).toContain("[Photo: photos/2023-12-24-1.jpg - The tree]");
    expect(out).toContain("Jacob, 2023-12-25:\nLove this.");
    expect(out).toContain("A family member, 2023-12-25:\nMerry Christmas");
  });
  it("ends with exactly one newline", () => {
    expect(out.endsWith("Merry Christmas\n")).toBe(true);
  });
  it("omits optional sections when absent", () => {
    const bare = formatLetterText({ ...letter, meditationTitle: null, meditationUrl: null, photos: [], comments: [] });
    expect(bare).not.toContain("Meditation");
    expect(bare).not.toContain("Comments");
    expect(bare.endsWith("It snowed.\n")).toBe(true);
  });
});

describe("formatAllLettersText", () => {
  it("separates letters with a divider", () => {
    const out = formatAllLettersText([letter, { ...letter, date: "2023-12-25" }]);
    expect(out.split("-".repeat(72)).length).toBe(2);
  });
});

describe("buildArchiveJson", () => {
  it("excludes internal ids and keeps comment content", () => {
    const parsed = JSON.parse(buildArchiveJson([letter], "2026-10-03T00:00:00Z"));
    expect(parsed.letterCount).toBe(1);
    expect(parsed.letters[0].id).toBeUndefined();
    expect(parsed.letters[0].comments).toHaveLength(2);
    expect(parsed.letters[0].photos[0].file).toBe("photos/2023-12-24-1.jpg");
  });
});

describe("formatChecksums", () => {
  it("emits sorted sha256sum-style lines", () => {
    expect(formatChecksums([{ path: "b", sha256: "2" }, { path: "a", sha256: "1" }])).toBe("1  a\n2  b\n");
  });
});

describe("buildReadme", () => {
  it("states the counts and date range", () => {
    const r = buildReadme({ generatedAt: "x", letterCount: 5, firstDate: "2018-02-06", lastDate: "2026-09-27", commentCount: 2, photoCount: 1, hasPdf: true });
    expect(r).toContain("5 letters, 2018-02-06 through 2026-09-27, with 2 family comments and 1 photos.");
  });
});
