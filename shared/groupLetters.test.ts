import { describe, expect, it } from "vitest";
import { groupLettersByYear } from "./groupLetters";
import type { LetterSummary } from "./types";

function letter(date: string, id = 1): LetterSummary {
  return { id, date, excerpt: `excerpt for ${date}`, hasPhoto: false };
}

describe("groupLettersByYear", () => {
  it("groups letters under their year and month", () => {
    const groups = groupLettersByYear([letter("2024-09-27"), letter("2024-08-01"), letter("2023-12-25")]);
    expect(groups).toHaveLength(2);
    expect(groups[0].year).toBe(2024);
    expect(groups[0].months.map((m) => m.month)).toEqual([9, 8]);
    expect(groups[1].year).toBe(2023);
  });

  it("orders years and months newest-first regardless of input order", () => {
    const groups = groupLettersByYear([letter("2020-01-01"), letter("2022-06-15"), letter("2021-03-03")]);
    expect(groups.map((g) => g.year)).toEqual([2022, 2021, 2020]);
  });

  it("preserves within-month letter order from the input", () => {
    const groups = groupLettersByYear([letter("2024-03-14", 2), letter("2024-03-01", 1)]);
    expect(groups[0].months[0].letters.map((l) => l.id)).toEqual([2, 1]);
  });

  it("keeps two same-day letters in the same month bucket", () => {
    const groups = groupLettersByYear([letter("2024-03-14", 1), letter("2024-03-14", 2)]);
    expect(groups[0].months[0].letters).toHaveLength(2);
  });

  it("returns an empty array for an empty list", () => {
    expect(groupLettersByYear([])).toEqual([]);
  });
});
