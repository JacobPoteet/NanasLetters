// HMAC-signed session tokens. Stateless — a token is `payload.exp.signature`
// where signature = HMAC-SHA256(payload.exp). The payload is the Role
// ("family" or "admin") granted by whichever passphrase was checked at login.
//
// Mirrors Lunch Special's worker/auth.ts pattern (same reasoning: a token IS
// the record, so it carries its own expiry and a signature proving nobody
// edited either).

import type { Role } from "../shared/types";

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** 128 bits, per RFC 2104's "at least half the output" allowance for truncation. */
const SIGNATURE_BYTES = 16;

async function sign(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const full = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(full.slice(0, SIGNATURE_BYTES));
}

async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await sign(data, secret);
  // Hash both sides so the comparison is fixed-length and timing-safe.
  const a = await crypto.subtle.digest("SHA-256", encoder.encode(expected));
  const b = await crypto.subtle.digest("SHA-256", encoder.encode(signature));
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

function encodeExpiry(atMs: number): string {
  return Math.ceil(atMs / 1000).toString(36);
}

function decodeExpiryMs(encoded: string): number | null {
  if (!/^[0-9a-z]+$/.test(encoded)) return null;
  const seconds = parseInt(encoded, 36);
  return Number.isSafeInteger(seconds) ? seconds * 1000 : null;
}

export async function createToken(payload: string, ttlMs: number, secret: string): Promise<string> {
  const data = `${payload}.${encodeExpiry(Date.now() + ttlMs)}`;
  return `${data}.${await sign(data, secret)}`;
}

/** Returns the payload if the token is authentic and unexpired, else null. */
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const data = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!(await verify(data, signature, secret))) return null;
  const expDot = data.lastIndexOf(".");
  if (expDot < 0) return null;
  const exp = decodeExpiryMs(data.slice(expDot + 1));
  if (exp === null || Date.now() > exp) return null;
  return data.slice(0, expDot);
}

/** Constant-time-ish passphrase check (compares SHA-256 digests). */
export async function passphraseMatches(supplied: string, expected: string): Promise<boolean> {
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(supplied)));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(expected)));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const SESSION_COOKIE = "nana_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isRole(payload: string | null): payload is Role {
  return payload === "family" || payload === "admin";
}
