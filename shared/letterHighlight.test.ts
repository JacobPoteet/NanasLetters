import { describe, expect, it } from "vitest";
import { paragraphsWithHighlight } from "./letterHighlight";

describe("paragraphsWithHighlight", () => {
  it("returns unhighlighted paragraphs when there's no match text", () => {
    const paragraphs = paragraphsWithHighlight("First line.\nSecond line.", null);
    expect(paragraphs).toEqual([
      { text: "First line.", highlightStart: null, highlightEnd: null },
      { text: "Second line.", highlightStart: null, highlightEnd: null },
    ]);
  });

  it("treats an empty match string the same as no match", () => {
    const paragraphs = paragraphsWithHighlight("First line.\nSecond line.", "");
    expect(paragraphs.every((p) => p.highlightStart === null)).toBe(true);
  });

  it("drops blank lines, matching the letter view's existing paragraph rendering", () => {
    const paragraphs = paragraphsWithHighlight("First line.\n\n\nSecond line.", null);
    expect(paragraphs.map((p) => p.text)).toEqual(["First line.", "Second line."]);
  });

  it("locates the match within the paragraph that contains it", () => {
    const paragraphs = paragraphsWithHighlight(
      "The tomatoes finally came in.\nThe garden was full this year.",
      "garden was full",
    );
    expect(paragraphs[0]).toEqual({ text: "The tomatoes finally came in.", highlightStart: null, highlightEnd: null });
    expect(paragraphs[1]).toEqual({ text: "The garden was full this year.", highlightStart: 4, highlightEnd: 19 });
  });

  it("highlights only the first occurrence when the same text repeats", () => {
    const paragraphs = paragraphsWithHighlight("coffee in the morning\ncoffee in the morning", "coffee");
    expect(paragraphs[0].highlightStart).toBe(0);
    expect(paragraphs[1].highlightStart).toBeNull();
  });

  it("leaves everything unhighlighted when the match text isn't found", () => {
    const paragraphs = paragraphsWithHighlight("First line.\nSecond line.", "nonexistent phrase");
    expect(paragraphs.every((p) => p.highlightStart === null)).toBe(true);
  });
});
