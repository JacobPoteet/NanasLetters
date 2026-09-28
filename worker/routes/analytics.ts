// Fire-and-forget visit beacon. Mounted alongside the rest of the
// family-gated routes (index.ts) — every page already requires at least a
// family session before it renders, so this is never truly public, but the
// payload itself still carries only an anonymous device id, never who
// logged in. See CLAUDE.md/#8: operational visibility only, no per-person
// tracking.

import { Hono } from "hono";
import type { AnalyticsPage } from "../../shared/types";
import { recordVisit } from "../db";

const app = new Hono<{ Bindings: Env }>();

const PAGES: AnalyticsPage[] = ["home", "browse", "letter", "search"];

app.post("/analytics/visit", async (c) => {
  let body: { deviceId?: unknown; page?: unknown; letterId?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const deviceId = body.deviceId;
  if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 64) {
    return c.json({ error: "Invalid deviceId" }, 400);
  }
  if (typeof body.page !== "string" || !PAGES.includes(body.page as AnalyticsPage)) {
    return c.json({ error: "Invalid page" }, 400);
  }
  const letterId =
    body.page === "letter" && typeof body.letterId === "number" && Number.isInteger(body.letterId)
      ? body.letterId
      : null;

  await recordVisit(c.env.DB, { deviceId, page: body.page as AnalyticsPage, letterId });
  return c.json({ ok: true });
});

export default app;
