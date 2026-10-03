import { describe, expect, it } from "vitest";
import { onThisDay, searchLetters } from "./archiveSearch";

const letters = [
  { date: "2018-09-27", text: "Coffee on the porch with the garden in bloom." },
  { date: "2019-09-27", text: "Church today. Then coffee." },
  { date: "2020-09-29", text: "Garden is done for the year." },
  { date: "2021-03-01", text: "<script>alert(1)</script> coffee" },
];

describe("searchLetters", () => {
  it("requires every token, case-insensitively", () => {
    expect(searchLetters(letters, { query: "COFFEE garden" }).map((h) => h.index)).toEqual([0]);
  });
  it("returns the match with surrounding text as plain strings", () => {
    const [hit] = searchLetters(letters, { query: "porch" });
    expect(hit.match).toBe("porch");
    expect(hit.before).toBe("Coffee on the ");
    expect(hit.after).toBe(" with the garden in bloom.");
  });
  it("applies an inclusive date range", () => {
    expect(searchLetters(letters, { query: "coffee", from: "2019-01-01", to: "2019-09-27" }).map((h) => h.index)).toEqual([1]);
  });
  it("reads by date alone when the query is empty", () => {
    const hits = searchLetters(letters, { query: "  ", from: "2020-01-01" });
    expect(hits.map((h) => h.index)).toEqual([2, 3]);
    expect(hits[0].after).toContain("Garden");
  });
  it("keeps markup in a letter as inert text", () => {
    const [hit] = searchLetters(letters, { query: "script" });
    expect(hit.before + hit.match + hit.after).toContain("<script>");
  });
});

describe("onThisDay", () => {
  it("returns exact matches newest year first", () => {
    expect(onThisDay(letters, "09-27")).toEqual({ exact: [1, 0], nearby: [] });
  });
  it("falls back to the nearest days within the window", () => {
    expect(onThisDay(letters, "09-28")).toEqual({ exact: [], nearby: [2, 1, 0] });
  });
  it("returns nothing when no day is close", () => {
    expect(onThisDay(letters, "06-15")).toEqual({ exact: [], nearby: [] });
  });
  it("treats the year boundary as adjacent", () => {
    expect(onThisDay([{ date: "2020-12-31", text: "x" }], "01-01").nearby).toEqual([0]);
  });
});
