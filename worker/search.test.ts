import { describe, expect, it } from "vitest";
import {
  buildFtsQuery,
  escapeAndMarkSnippet,
  plainSnippetText,
  SNIPPET_ELLIPSIS,
  SNIPPET_MARK_END,
  SNIPPET_MARK_START,
} from "./search";

describe("buildFtsQuery", () => {
  it("ANDs together multiple words", () => {
    expect(buildFtsQuery("tomatoes garden")).toBe('"tomatoes" AND "garden"');
  });

  it("strips punctuation that FTS5 would otherwise treat as query syntax", () => {
    expect(buildFtsQuery("don't stop")).toBe('"don" AND "t" AND "stop"');
    expect(buildFtsQuery('quote "marks" (parens) -dash')).toBe('"quote" AND "marks" AND "parens" AND "dash"');
  });

  it("returns null for a query with no searchable words", () => {
    expect(buildFtsQuery("")).toBeNull();
    expect(buildFtsQuery("   ")).toBeNull();
    expect(buildFtsQuery("***")).toBeNull();
  });

  it("keeps non-ASCII letters (accented names, her occasional Spanish)", () => {
    expect(buildFtsQuery("café Thérèse")).toBe('"café" AND "Thérèse"');
  });
});

describe("escapeAndMarkSnippet", () => {
  it("turns the marker characters into real <mark> tags", () => {
    const raw = `the ${SNIPPET_MARK_START}garden${SNIPPET_MARK_END} was full`;
    expect(escapeAndMarkSnippet(raw)).toBe("the <mark>garden</mark> was full");
  });

  it("escapes a literal angle bracket in her own words instead of injecting it as a tag", () => {
    // The actual bug this exists to prevent: a naive dangerouslySetInnerHTML
    // on the raw FTS5 snippet would let "<3" or a pasted email address open
    // an unclosed tag in the rendered page.
    const raw = `sent you a <3 this morning, ${SNIPPET_MARK_START}love${SNIPPET_MARK_END} you`;
    expect(escapeAndMarkSnippet(raw)).toBe("sent you a &lt;3 this morning, <mark>love</mark> you");
  });

  it("escapes a literal ampersand", () => {
    expect(escapeAndMarkSnippet("Church & the choir")).toBe("Church &amp; the choir");
  });
});

describe("plainSnippetText", () => {
  it("strips the mark delimiters, recovering the real text", () => {
    const raw = `the ${SNIPPET_MARK_START}garden${SNIPPET_MARK_END} was full`;
    expect(plainSnippetText(raw)).toBe("the garden was full");
  });

  it("strips a leading ellipsis added when the match isn't at the start", () => {
    expect(plainSnippetText(`${SNIPPET_ELLIPSIS}the ${SNIPPET_MARK_START}garden${SNIPPET_MARK_END} was full`)).toBe(
      "the garden was full",
    );
  });

  it("strips a trailing ellipsis added when the letter continues past the window", () => {
    expect(plainSnippetText(`the ${SNIPPET_MARK_START}garden${SNIPPET_MARK_END} was full${SNIPPET_ELLIPSIS}`)).toBe(
      "the garden was full",
    );
  });

  it("strips ellipses on both ends when the match is truncated on both sides", () => {
    const raw = `${SNIPPET_ELLIPSIS}quiet here today, just birds and the ${SNIPPET_MARK_START}coffee${SNIPPET_MARK_END} pot${SNIPPET_ELLIPSIS}`;
    expect(plainSnippetText(raw)).toBe("quiet here today, just birds and the coffee pot");
  });

  it("leaves a snippet with no truncation and no match untouched", () => {
    expect(plainSnippetText("It is quiet here today")).toBe("It is quiet here today");
  });
});
