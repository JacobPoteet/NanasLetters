import { describe, expect, it } from "vitest";
import { decodeSearchQuery, encodeSearchQuery } from "./searchQuery";

describe("encodeSearchQuery", () => {
  it("returns an empty string when nothing is set", () => {
    expect(encodeSearchQuery({ query: "", from: null, to: null, sort: "relevance" })).toBe("");
  });

  it("encodes just the query text", () => {
    expect(encodeSearchQuery({ query: "garden", from: null, to: null, sort: "relevance" })).toBe("?q=garden");
  });

  it("encodes a date-only search with no query text", () => {
    expect(
      encodeSearchQuery({ query: "", from: "2020-01-01", to: "2020-02-01", sort: "relevance" }),
    ).toBe("?from=2020-01-01&to=2020-02-01");
  });

  it("encodes query text plus a date range together", () => {
    const qs = encodeSearchQuery({ query: "garden", from: "2020-01-01", to: null, sort: "relevance" });
    expect(qs).toBe("?q=garden&from=2020-01-01");
  });

  it("percent-encodes characters that would otherwise break the query string", () => {
    expect(encodeSearchQuery({ query: "coffee & tea", from: null, to: null, sort: "relevance" })).toBe(
      "?q=coffee+%26+tea",
    );
  });

  it("omits sort when it's the default (relevance)", () => {
    expect(encodeSearchQuery({ query: "garden", from: null, to: null, sort: "relevance" })).not.toContain("sort");
  });

  it("includes a non-default sort", () => {
    expect(encodeSearchQuery({ query: "garden", from: null, to: null, sort: "oldest" })).toBe(
      "?q=garden&sort=oldest",
    );
  });
});

describe("decodeSearchQuery", () => {
  it("returns empty state for an empty search string", () => {
    expect(decodeSearchQuery("")).toEqual({ query: "", from: null, to: null, sort: "relevance" });
  });

  it("reads q, from, and to back out", () => {
    expect(decodeSearchQuery("?q=garden&from=2020-01-01&to=2020-02-01")).toEqual({
      query: "garden",
      from: "2020-01-01",
      to: "2020-02-01",
      sort: "relevance",
    });
  });

  it("defaults query to an empty string when only dates are present", () => {
    expect(decodeSearchQuery("?from=2020-01-01")).toEqual({
      query: "",
      from: "2020-01-01",
      to: null,
      sort: "relevance",
    });
  });

  it("reads a valid sort value", () => {
    expect(decodeSearchQuery("?q=garden&sort=newest").sort).toBe("newest");
  });

  it("falls back to relevance for a missing or invalid sort value", () => {
    expect(decodeSearchQuery("?q=garden").sort).toBe("relevance");
    expect(decodeSearchQuery("?q=garden&sort=nonsense").sort).toBe("relevance");
  });

  it("round-trips through encodeSearchQuery", () => {
    const state = { query: "coffee & tea", from: "2020-01-01", to: "2020-02-01", sort: "oldest" as const };
    expect(decodeSearchQuery(encodeSearchQuery(state))).toEqual(state);
  });
});
