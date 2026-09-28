// /api/admin/*: gated by the admin-only guard mounted in index.ts (a valid
// admin session, not just a family one). Letter corrections and the
// ingestion review queue — see CLAUDE.md's Functionality section.

import { Hono } from "hono";
import {
  acceptReviewItem,
  deleteLetter,
  dismissReviewItem,
  getAnalyticsSummary,
  getCalendarSummary,
  getLetterById,
  getReviewItemById,
  listReviewQueue,
  updateLetter,
} from "../db";

const app = new Hono<{ Bindings: Env }>();

app.get("/analytics", async (c) => {
  return c.json(await getAnalyticsSummary(c.env.DB));
});

app.get("/calendar", async (c) => {
  return c.json(await getCalendarSummary(c.env.DB));
});

app.get("/review-queue", async (c) => {
  const status = c.req.query("status") ?? "pending";
  return c.json({ items: await listReviewQueue(c.env.DB, status) });
});

// Genuinely not a letter (e.g. a mis-labeled reply-thread message, or a
// duplicate of a letter that already exists) — no `letters` row is created.
app.post("/review-queue/:id/dismiss", async (c) => {
  const id = Number(c.req.param("id"));
  const item = await getReviewItemById(c.env.DB, id);
  if (!item) return c.json({ error: "Not found" }, 404);
  if (item.status !== "pending") return c.json({ error: "Already resolved" }, 409);
  await dismissReviewItem(c.env.DB, id);
  return c.json({ ok: true });
});

// The human call the review queue exists for: takes the (possibly edited)
// fields and actually writes the letter, instead of just flipping a status
// column — see the linked issue for why the old /resolve endpoint was a bug.
app.post("/review-queue/:id/accept", async (c) => {
  const id = Number(c.req.param("id"));
  let body: { date?: string; text?: string; meditationTitle?: string | null; meditationUrl?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return c.json({ error: "date must be YYYY-MM-DD" }, 400);
  }
  if (!body.text || body.text.trim().length === 0) {
    return c.json({ error: "text must not be empty" }, 400);
  }

  const item = await getReviewItemById(c.env.DB, id);
  if (!item) return c.json({ error: "Not found" }, 404);
  if (item.status !== "pending") return c.json({ error: "Already resolved" }, 409);

  const letterId = await acceptReviewItem(c.env.DB, id, item.gmailMessageId, {
    date: body.date,
    text: body.text,
    meditationTitle: body.meditationTitle ?? null,
    meditationUrl: body.meditationUrl ?? null,
  });
  const letter = await getLetterById(c.env.DB, letterId);
  return c.json({ letter });
});

app.put("/letters/:id", async (c) => {
  const id = Number(c.req.param("id"));
  let body: { date?: string; text?: string; meditationTitle?: string | null; meditationUrl?: string | null };
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

// Removes a same-day duplicate that should have been merged (CLAUDE.md's
// Functionality spec names this by name) — the only write path that permits
// it is here, so a two-step confirm in the UI is the only real safeguard.
app.delete("/letters/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const letter = await getLetterById(c.env.DB, id);
  if (!letter) return c.json({ error: "Not found" }, 404);
  await deleteLetter(c.env.DB, id);
  return c.json({ ok: true });
});

export default app;
