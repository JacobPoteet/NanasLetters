import { describe, expect, it } from "vitest";
import { decodeBase64Url, findPartsByMimeType } from "./gmail";

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

describe("decodeBase64Url", () => {
  it("round-trips plain ASCII", () => {
    expect(decodeBase64Url(encodeBase64Url("Hello, world."))).toBe("Hello, world.");
  });

  it("round-trips UTF-8 (her occasional Spanish, accented names)", () => {
    expect(decodeBase64Url(encodeBase64Url("café, Thérèse, ¡hola!"))).toBe("café, Thérèse, ¡hola!");
  });

  it("handles input needing every padding length", () => {
    // Base64 needs 0-3 '=' of padding depending on input length mod 3.
    expect(decodeBase64Url(encodeBase64Url("a"))).toBe("a");
    expect(decodeBase64Url(encodeBase64Url("ab"))).toBe("ab");
    expect(decodeBase64Url(encodeBase64Url("abc"))).toBe("abc");
  });
});

describe("findPartsByMimeType", () => {
  it("finds a single top-level part with no nesting", () => {
    const payload = { mimeType: "text/plain", body: { data: encodeBase64Url("hello") } };
    expect(findPartsByMimeType(payload, "text/plain")).toEqual(["hello"]);
  });

  it("recurses into nested multipart/alternative parts", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: encodeBase64Url("plain version") } },
            { mimeType: "text/html", body: { data: encodeBase64Url("<p>html version</p>") } },
          ],
        },
      ],
    };
    expect(findPartsByMimeType(payload, "text/plain")).toEqual(["plain version"]);
    expect(findPartsByMimeType(payload, "text/html")).toEqual(["<p>html version</p>"]);
  });

  it("returns an empty array when the MIME type isn't present anywhere", () => {
    const payload = { mimeType: "text/html", body: { data: encodeBase64Url("<p>hi</p>") } };
    expect(findPartsByMimeType(payload, "text/plain")).toEqual([]);
  });

  it("skips a part with no body data instead of throwing", () => {
    const payload = { mimeType: "text/plain" };
    expect(findPartsByMimeType(payload, "text/plain")).toEqual([]);
  });
});
