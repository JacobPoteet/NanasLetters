import { describe, expect, it } from "vitest";
import { resolveInternalPath } from "./internalPath";

const ORIGIN = "https://nanas-letters.example";

describe("resolveInternalPath", () => {
  it("passes through a plain path unchanged", () => {
    expect(resolveInternalPath("/letters/5", ORIGIN)).toBe("/letters/5");
  });

  it("preserves a query string", () => {
    expect(resolveInternalPath("/search?q=garden&from=2020-01-01", ORIGIN)).toBe(
      "/search?q=garden&from=2020-01-01",
    );
  });

  it("blocks a javascript: URI", () => {
    expect(resolveInternalPath("javascript:alert(1)", ORIGIN)).toBe("/");
  });

  it("blocks a data: URI", () => {
    expect(resolveInternalPath("data:text/html,<script>alert(1)</script>", ORIGIN)).toBe("/");
  });

  it("blocks a protocol-relative URL to another host", () => {
    expect(resolveInternalPath("//evil.example/phish", ORIGIN)).toBe("/");
  });

  it("blocks an absolute URL to another origin", () => {
    expect(resolveInternalPath("https://evil.example/phish", ORIGIN)).toBe("/");
  });

  it("allows an absolute URL that happens to match our own origin", () => {
    expect(resolveInternalPath(`${ORIGIN}/browse`, ORIGIN)).toBe("/browse");
  });

  it("falls back to / for input the URL parser rejects outright", () => {
    expect(resolveInternalPath("http://[::1", ORIGIN)).toBe("/");
  });
});
