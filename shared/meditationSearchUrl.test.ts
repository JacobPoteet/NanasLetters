import { describe, expect, it } from "vitest";
import { meditationSearchUrl } from "./meditationSearchUrl";

describe("meditationSearchUrl", () => {
  it("builds a cac.org search URL from the letter's date", () => {
    expect(meditationSearchUrl("2020-09-28")).toBe("https://cac.org/?s=September+28%2C+2020");
  });

  it("does not zero-pad the day or month name", () => {
    expect(meditationSearchUrl("2018-02-06")).toBe("https://cac.org/?s=February+6%2C+2018");
  });

  it("handles a December date", () => {
    expect(meditationSearchUrl("2023-12-25")).toBe("https://cac.org/?s=December+25%2C+2023");
  });
});
