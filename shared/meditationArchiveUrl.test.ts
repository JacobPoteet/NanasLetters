import { describe, expect, it } from "vitest";
import { meditationArchiveUrl } from "./meditationArchiveUrl";

describe("meditationArchiveUrl", () => {
  it("builds a cac.org date-archive URL from the letter's date", () => {
    expect(meditationArchiveUrl("2020-09-28")).toBe("https://cac.org/category/daily-meditations/2020/09/28/");
  });

  it("keeps zero-padded month and day", () => {
    expect(meditationArchiveUrl("2018-02-06")).toBe("https://cac.org/category/daily-meditations/2018/02/06/");
  });

  it("handles a December date", () => {
    expect(meditationArchiveUrl("2023-12-25")).toBe("https://cac.org/category/daily-meditations/2023/12/25/");
  });
});
