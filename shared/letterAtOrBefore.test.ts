import { describe, expect, it } from "vitest";
import { letterAtOrBefore } from "./letterAtOrBefore";
import type { LetterSummary } from "./types";

function letter(date: string, id: number): LetterSummary {
  return { id, date, excerpt: "", hasPhoto: false };
}

const letters = [letter("2024-03-14", 4), letter("2024-03-01", 3), letter("2023-12-25", 2), letter("2023-01-02", 1)];

describe("letterAtOrBefore", () => {
  it("returns the letter on the exact date", () => {
    expect(letterAtOrBefore(letters, "2024-03-01")?.id).toBe(3);
  });

  it("returns the nearest earlier letter when the date has none", () => {
    expect(letterAtOrBefore(letters, "2024-02-10")?.id).toBe(2);
  });

  it("returns the newest letter for a date after the archive ends", () => {
    expect(letterAtOrBefore(letters, "2030-01-01")?.id).toBe(4);
  });

  it("falls back to the oldest letter for a date before the archive begins", () => {
    expect(letterAtOrBefore(letters, "2010-01-01")?.id).toBe(1);
  });

  it("returns null for an empty list", () => {
    expect(letterAtOrBefore([], "2024-01-01")).toBeNull();
  });
});
