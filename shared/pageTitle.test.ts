import { describe, expect, it } from "vitest";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("is just the site name with no section", () => {
    expect(pageTitle()).toBe("The Daily");
  });

  it("treats null the same as no section", () => {
    expect(pageTitle(null)).toBe("The Daily");
  });

  it("prefixes the section before the site name", () => {
    expect(pageTitle("Browse")).toBe("Browse — The Daily");
  });

  it("treats an empty string the same as no section", () => {
    expect(pageTitle("")).toBe("The Daily");
  });
});
