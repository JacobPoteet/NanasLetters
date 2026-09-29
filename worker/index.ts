// Nana's Letters API. Static assets (the React app) are served by Workers
// Assets; `run_worker_first: ["/api/*"]` means only API requests land here.
//
// Mount order is load-bearing: Hono applies a middleware to every route
// registered after it. Auth routes need no session; everything under
// requireRole("family") needs at least a family session; everything under
// requireRole("admin") needs specifically an admin one.

import { Hono } from "hono";
import authRoutes, { requireRole } from "./routes/auth";
import lettersRoutes from "./routes/letters";
import analyticsRoutes from "./routes/analytics";
import commentsRoutes from "./routes/comments";
import adminRoutes from "./routes/admin";
import { runIngestion } from "./ingestion/sync";
import { runBackup } from "./backup";

// Must match wrangler.jsonc's triggers.crons exactly — that's the only place
// these schedules are configured, so the scheduled handler below tells the
// two crons apart by comparing against these literals.
const BACKUP_CRON = "0 14 * * *";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", authRoutes);

app.use("/api/*", requireRole("family"));
app.route("/api", lettersRoutes);
app.route("/api", analyticsRoutes);
app.route("/api", commentsRoutes);

app.use("/api/admin/*", requireRole("admin"));
app.route("/api/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(JSON.stringify({ message: "unhandled error", error: String(err), path: c.req.path }));
  return c.json({ error: "Something went wrong" }, 500);
});

export default {
  fetch: app.fetch,
  // Daily Cron Trigger (see wrangler.jsonc) — backfill and ongoing ingestion
  // share this one handler (CLAUDE.md's Tech stack decision).
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === BACKUP_CRON) {
      ctx.waitUntil(
        runBackup(env)
          .then((result) => {
            console.log(JSON.stringify({ message: "backup complete", ...result }));
          })
          .catch((err) => {
            // Same reasoning as ingestion's failure log below: a silently
            // failing backup is as bad as no backup at all. console.error is
            // a stopgap, not the fix — tracked as
            // https://github.com/JacobPoteet/NanasLetters/issues/2.
            console.error(JSON.stringify({ message: "backup run FAILED", error: String(err) }));
          }),
      );
      return;
    }

    ctx.waitUntil(
      runIngestion(env)
        .then((result) => {
          console.log(
            JSON.stringify({ message: result.skipped ? "ingestion skipped (not configured, see #6)" : "ingestion run complete", ...result }),
          );
        })
        .catch((err) => {
          // See CLAUDE.md's "Ingestion health monitoring" note: a silent
          // failure here is exactly the risk of depending on one OAuth token
          // forever. console.error is a stopgap, not the fix — tracked as
          // https://github.com/JacobPoteet/NanasLetters/issues/2.
          console.error(JSON.stringify({ message: "ingestion run FAILED", error: String(err) }));
        }),
    );
  },
};
