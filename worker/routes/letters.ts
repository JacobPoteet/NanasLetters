// Family-facing letter routes. Everything here requires at least a "family"
// session — the guard is mounted in index.ts, ahead of this router.

import { Hono } from "hono";
import { browseLetters, getAdjacentLetterId, getArchiveStats, getLetterById, getOnThisDay, searchLetters } from "../db";
import { todayMonthDay } from "../dateWindow";

const app = new Hono<{ Bindings: Env }>();

app.get("/stats", async (c) => {
  return c.json(await getArchiveStats(c.env.DB));
});

app.get("/on-this-day", async (c) => {
  const monthDay = c.req.query("date") ?? todayMonthDay();
  if (!/^\d{2}-\d{2}$/.test(monthDay)) return c.json({ error: "date must be MM-DD" }, 400);
  return c.json(await getOnThisDay(c.env.DB, monthDay));
});

app.get("/letters", async (c) => {
  const year = c.req.query("year");
  const month = c.req.query("month");
  const beforeDate = c.req.query("beforeDate");
  const beforeId = c.req.query("beforeId");
  const letters = await browseLetters(c.env.DB, {
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    before: beforeDate && beforeId ? { date: beforeDate, id: Number(beforeId) } : undefined,
  });
  return c.json({ letters });
});

app.get("/letters/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
  const letter = await getLetterById(c.env.DB, id);
  if (!letter) return c.json({ error: "Not found" }, 404);
  const [prevId, nextId] = await Promise.all([
    getAdjacentLetterId(c.env.DB, letter.date, "prev"),
    getAdjacentLetterId(c.env.DB, letter.date, "next"),
  ]);
  return c.json({ letter, prevId, nextId });
});

app.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const from = c.req.query("from");
  const to = c.req.query("to");
  const results = await searchLetters(c.env.DB, q, { from, to });
  return c.json({ results });
});

// Serves a letter's photo out of R2. Not wired to a real bucket yet — R2
// needs enabling on the Cloudflare account first; see wrangler.jsonc.
app.get("/photos/:key", async (c) => {
  const photos = c.env.PHOTOS;
  if (!photos) return c.json({ error: "Photo storage not configured yet" }, 503);
  const object = await photos.get(c.req.param("key"));
  if (!object) return c.json({ error: "Not found" }, 404);
  return new Response(object.body, {
    headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream" },
  });
});

export default app;
