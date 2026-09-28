import { describe, expect, it } from "vitest";
import { isSameLetter } from "./duplicate";

describe("isSameLetter", () => {
  it("treats identical text as the same letter", () => {
    expect(isSameLetter("Hello there.", "Hello there.")).toBe(true);
  });

  it("ignores whitespace-only differences (a resend with different line wrapping)", () => {
    expect(isSameLetter("Hello   there.\n\n", "  Hello there. ")).toBe(true);
  });

  it("treats genuinely different text as a different letter", () => {
    expect(isSameLetter("Hello there.", "Hello there, and one more thing.")).toBe(false);
  });
});
