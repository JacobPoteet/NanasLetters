// /api/admin/*: gated by the admin-only guard mounted in index.ts (a valid
// admin session, not just a family one). Letter corrections and the
// ingestion review queue — see CLAUDE.md's Functionality section.

import { Hono } from "hono";
import { getLetterById, listReviewQueue, resolveReviewItem, updateLetter } from "../db";

const app = new Hono<{ Bindings: Env }>();

app.get("/review-queue", async (c) => {
  const status = c.req.query("status") ?? "pending";
  return c.json({ items: await listReviewQueue(c.env.DB, status) });
});

app.post("/review-queue/:id/resolve", async (c) => {
  const id = Number(c.req.param("id"));
  let body: { status?: "resolved" | "dismissed" };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (body.status !== "resolved" && body.status !== "dismissed") {
    return c.json({ error: "status must be 'resolved' or 'dismissed'" }, 400);
  }
  await resolveReviewItem(c.env.DB, id, body.status);
  return c.json({ ok: true });
});

app.put("/letters/:id", async (c) => {
  const id = Number(c.req.param("id"));
  let body: { date?: string; text?: string; meditationTitle?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (body.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return c.json({ error: "date must be YYYY-MM-DD" }, 400);
  }
  await updateLetter(c.env.DB, id, body);
  const letter = await getLetterById(c.env.DB, id);
  if (!letter) return c.json({ error: "Not found" }, 404);
  return c.json({ letter });
});

export default app;
