// Family-facing comment routes. Everything here already requires at least a
// "family" session — the guard is mounted in index.ts, ahead of this router
// — same as letters.ts. The comments_require_login check inside the POST
// handler below is deliberately redundant with that today; see its comment.

import { Hono } from "hono";
import { validateComment } from "../../shared/validateComment";
import { hashForModeration } from "../auth";
import {
  getCommentsForLetter,
  getCommentsRequireLogin,
  getLetterById,
  getRecentComments,
  insertComment,
  isCommentRateLimited,
  isDeviceBanned,
} from "../db";
import { currentRole } from "./auth";

const app = new Hono<{ Bindings: Env }>();

const RECENT_COMMENTS_MAX = 20;

app.get("/comments/recent", async (c) => {
  const requested = Number(c.req.query("limit") ?? "8");
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, RECENT_COMMENTS_MAX) : 8;
  return c.json({ comments: await getRecentComments(c.env.DB, limit) });
});

app.get("/letters/:id/comments", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
  return c.json({ comments: await getCommentsForLetter(c.env.DB, id) });
});

app.post("/letters/:id/comments", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

  // Forward-looking, not load-bearing today: index.ts already puts every
  // /api/* route behind requireRole("family"), so this only starts to matter
  // once that blanket gate is lifted for a public site — see CLAUDE.md.
  if (await getCommentsRequireLogin(c.env.DB)) {
    const role = await currentRole(c);
    if (!role) return c.json({ error: "Not logged in" }, 401);
  }

  let body: { authorName?: unknown; body?: unknown; deviceId?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const deviceId = body.deviceId;
  if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 64) {
    return c.json({ error: "Invalid deviceId" }, 400);
  }

  const validated = validateComment({ authorName: body.authorName, body: body.body });
  if (!validated.ok) return c.json({ error: validated.error }, 400);

  const letter = await getLetterById(c.env.DB, id);
  if (!letter) return c.json({ error: "Not found" }, 404);

  if (await isDeviceBanned(c.env.DB, deviceId)) return c.json({ error: "Not allowed" }, 403);
  if (await isCommentRateLimited(c.env.DB, deviceId)) {
    return c.json({ error: "Slow down a moment before commenting again" }, 429);
  }

  const ip = c.req.header("CF-Connecting-IP");
  const ipHash = ip ? await hashForModeration(ip, c.env.SESSION_SECRET) : null;

  const commentId = await insertComment(c.env.DB, {
    letterId: id,
    deviceId,
    ipHash,
    authorName: validated.value.authorName,
    body: validated.value.body,
  });

  const comments = await getCommentsForLetter(c.env.DB, id);
  const created = comments.find((comment) => comment.id === commentId);
  return c.json({ comment: created });
});

export default app;
