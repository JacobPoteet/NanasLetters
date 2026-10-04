import { describe, expect, it } from "vitest";
import { oppositeTheme, parseStoredTheme, resolveTheme } from "./theme";

describe("parseStoredTheme", () => {
  it("accepts the two valid values", () => {
    expect(parseStoredTheme("light")).toBe("light");
    expect(parseStoredTheme("dark")).toBe("dark");
  });

  it("rejects anything else, including null and stale junk", () => {
    expect(parseStoredTheme(null)).toBeNull();
    expect(parseStoredTheme("")).toBeNull();
    expect(parseStoredTheme("Dark")).toBeNull();
    expect(parseStoredTheme("auto")).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("follows the OS when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("lets an explicit choice override the OS either way", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("oppositeTheme", () => {
  it("flips", () => {
    expect(oppositeTheme("dark")).toBe("light");
    expect(oppositeTheme("light")).toBe("dark");
  });
});
