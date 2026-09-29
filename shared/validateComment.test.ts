import { describe, expect, it } from "vitest";
import { MAX_COMMENT_BODY_LENGTH, MAX_COMMENT_NAME_LENGTH, validateComment } from "./validateComment";

describe("validateComment", () => {
  it("accepts a body with no name", () => {
    const result = validateComment({ body: "What a lovely letter." });
    expect(result).toEqual({ ok: true, value: { authorName: null, body: "What a lovely letter." } });
  });

  it("trims and keeps a provided name", () => {
    const result = validateComment({ authorName: "  Aunt Carol  ", body: "  Made me cry.  " });
    expect(result).toEqual({ ok: true, value: { authorName: "Aunt Carol", body: "Made me cry." } });
  });

  it("treats a whitespace-only name as no name", () => {
    const result = validateComment({ authorName: "   ", body: "Love this one." });
    expect(result).toEqual({ ok: true, value: { authorName: null, body: "Love this one." } });
  });

  it("rejects a missing body", () => {
    expect(validateComment({})).toEqual({ ok: false, error: "Comment text is required" });
  });

  it("rejects a whitespace-only body", () => {
    expect(validateComment({ body: "   " })).toEqual({ ok: false, error: "Comment text is required" });
  });

  it("rejects a body over the length limit", () => {
    const result = validateComment({ body: "a".repeat(MAX_COMMENT_BODY_LENGTH + 1) });
    expect(result.ok).toBe(false);
  });

  it("rejects a name over the length limit", () => {
    const result = validateComment({ authorName: "a".repeat(MAX_COMMENT_NAME_LENGTH + 1), body: "hi" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string body", () => {
    expect(validateComment({ body: 42 })).toEqual({ ok: false, error: "Comment text is required" });
  });
});
