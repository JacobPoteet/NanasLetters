// /api/admin/*: gated by the admin-only guard mounted in index.ts (a valid
// admin session, not just a family one). Letter corrections and the
// ingestion review queue — see CLAUDE.md's Functionality section.

import { Hono } from "hono";
import {
  acceptReviewItem,
  banDevice,
  deleteComment,
  deleteCommentsByDevice,
  deleteLetter,
  dismissReviewItem,
  getAnalyticsSummary,
  getCalendarSummary,
  getCommentsAdminSummary,
  getCommentsRequireLogin,
  getLetterById,
  getReviewItemById,
  listBannedDevices,
  listCommentsForAdmin,
  listReviewQueue,
  setCommentsRequireLogin,
  unbanDevice,
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

// --- Comments moderation (Jacob's ask: delete a comment, ban a device, or
// wipe everything from a device, plus a usage-tracking header strip) ---

app.get("/comments", async (c) => {
  const letterId = c.req.query("letterId");
  const deviceId = c.req.query("deviceId");
  const includeDeleted = c.req.query("includeDeleted") === "true";
  const comments = await listCommentsForAdmin(c.env.DB, {
    letterId: letterId ? Number(letterId) : undefined,
    deviceId: deviceId ?? undefined,
    includeDeleted,
  });
  return c.json({ comments });
});

app.get("/comments/summary", async (c) => {
  return c.json(await getCommentsAdminSummary(c.env.DB));
});

app.get("/comments/banned", async (c) => {
  return c.json({ devices: await listBannedDevices(c.env.DB) });
});

app.delete("/comments/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
  await deleteComment(c.env.DB, id);
  return c.json({ ok: true });
});

// Every comment this device ever left, gone at once — the "someone
// bombarded the site" response, not a one-at-a-time cleanup.
app.delete("/comments/device/:deviceId", async (c) => {
  await deleteCommentsByDevice(c.env.DB, c.req.param("deviceId"));
  return c.json({ ok: true });
});

app.post("/comments/device/:deviceId/ban", async (c) => {
  let body: { reason?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    // A ban with no request body (or a malformed one) is still a ban — the
    // reason is a courtesy note to future-Jacob, not required input.
  }
  const reason = typeof body.reason === "string" && body.reason.trim() !== "" ? body.reason.trim() : null;
  await banDevice(c.env.DB, c.req.param("deviceId"), reason);
  return c.json({ ok: true });
});

app.post("/comments/device/:deviceId/unban", async (c) => {
  await unbanDevice(c.env.DB, c.req.param("deviceId"));
  return c.json({ ok: true });
});

app.get("/settings", async (c) => {
  return c.json({ commentsRequireLogin: await getCommentsRequireLogin(c.env.DB) });
});

app.put("/settings", async (c) => {
  let body: { commentsRequireLogin?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body.commentsRequireLogin !== "boolean") {
    return c.json({ error: "commentsRequireLogin must be a boolean" }, 400);
  }
  await setCommentsRequireLogin(c.env.DB, body.commentsRequireLogin);
  return c.json({ ok: true });
});

export default app;
