import { describe, expect, it } from "vitest";
import { createToken, hashForModeration, isRole, passphraseMatches, verifyToken } from "./auth";

const SECRET = "test-secret-not-a-real-one";
const HOUR = 3_600_000;

describe("createToken / verifyToken", () => {
  it("round-trips a role payload", async () => {
    const token = await createToken("family", HOUR, SECRET);
    expect(await verifyToken(token, SECRET)).toBe("family");
  });

  it("refuses a token signed with another secret", async () => {
    const token = await createToken("admin", HOUR, SECRET);
    expect(await verifyToken(token, "a-different-secret")).toBeNull();
  });

  it("refuses a token whose payload was edited (family escalating to admin)", async () => {
    // The whole point of signing: a family cookie can't be hand-edited into an
    // admin one without invalidating the signature.
    const token = await createToken("family", HOUR, SECRET);
    const forged = token.replace("family", "admin");
    expect(await verifyToken(forged, SECRET)).toBeNull();
  });

  it("refuses a token whose expiry was pushed out", async () => {
    const token = await createToken("family", HOUR, SECRET);
    const [payload, , sig] = token.split(".");
    const forged = `${payload}.${(Math.ceil(Date.now() / 1000) + 999_999).toString(36)}.${sig}`;
    expect(await verifyToken(forged, SECRET)).toBeNull();
  });

  it("refuses an expired token", async () => {
    const token = await createToken("family", -1000, SECRET);
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  it("refuses junk", async () => {
    expect(await verifyToken("", SECRET)).toBeNull();
    expect(await verifyToken("nodots", SECRET)).toBeNull();
    expect(await verifyToken("a.b", SECRET)).toBeNull();
  });
});

describe("isRole", () => {
  it("accepts the two known roles and nothing else", () => {
    expect(isRole("family")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole(null)).toBe(false);
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("")).toBe(false);
  });
});

describe("passphraseMatches", () => {
  it("matches identical passphrases and rejects everything else", async () => {
    expect(await passphraseMatches("open-sesame", "open-sesame")).toBe(true);
    expect(await passphraseMatches("open-sesam", "open-sesame")).toBe(false);
    expect(await passphraseMatches("", "open-sesame")).toBe(false);
  });
});

describe("hashForModeration", () => {
  it("is deterministic for the same value and secret", async () => {
    const a = await hashForModeration("203.0.113.5", SECRET);
    const b = await hashForModeration("203.0.113.5", SECRET);
    expect(a).toBe(b);
  });

  it("differs for different values", async () => {
    const a = await hashForModeration("203.0.113.5", SECRET);
    const b = await hashForModeration("203.0.113.6", SECRET);
    expect(a).not.toBe(b);
  });

  it("differs for different secrets, so it can't be recomputed off-platform", async () => {
    const a = await hashForModeration("203.0.113.5", SECRET);
    const b = await hashForModeration("203.0.113.5", "a-different-secret");
    expect(a).not.toBe(b);
  });
});
