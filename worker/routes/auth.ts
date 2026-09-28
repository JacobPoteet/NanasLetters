// /api/login, /api/logout, /api/session — the only routes that don't need a
// session; index.ts mounts them ahead of the family/admin guards.

import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role } from "../../shared/types";
import { createToken, isRole, passphraseMatches, SESSION_COOKIE, SESSION_TTL_MS, verifyToken } from "../auth";

const app = new Hono<{ Bindings: Env }>();

export async function currentRole(c: Context<{ Bindings: Env }>): Promise<Role | null> {
  const cookie = getCookie(c, SESSION_COOKIE);
  if (!cookie) return null;
  const payload = await verifyToken(cookie, c.env.SESSION_SECRET);
  return isRole(payload) ? payload : null;
}

/**
 * Guards every route registered after it (Hono applies middleware in
 * registration order — see worker/index.ts's mount order comment). "family"
 * accepts either role, since the admin passphrase grants family access too;
 * "admin" accepts only an admin session.
 */
export function requireRole(minRole: Role): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const role = await currentRole(c);
    if (!role) return c.json({ error: "Not logged in" }, 401);
    if (minRole === "admin" && role !== "admin") return c.json({ error: "Admin access required" }, 403);
    await next();
  };
}

/** Admin passphrase grants family access too — same person, stronger secret. */
async function resolveRole(passphrase: string, env: Env): Promise<Role | null> {
  if (await passphraseMatches(passphrase, env.ADMIN_PASSPHRASE)) return "admin";
  if (await passphraseMatches(passphrase, env.FAMILY_PASSPHRASE)) return "family";
  return null;
}

app.post("/login", async (c) => {
  let body: { passphrase?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.passphrase) return c.json({ error: "Passphrase required" }, 400);

  const role = await resolveRole(body.passphrase, c.env);
  if (!role) return c.json({ error: "Wrong passphrase" }, 401);

  const token = await createToken(role, SESSION_TTL_MS, c.env.SESSION_SECRET);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return c.json({ ok: true, role });
});

app.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/session", async (c) => {
  return c.json({ role: await currentRole(c) });
});

export default app;
