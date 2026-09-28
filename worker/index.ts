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
import adminRoutes from "./routes/admin";
import { runIngestion } from "./ingestion/sync";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", authRoutes);

app.use("/api/*", requireRole("family"));
app.route("/api", lettersRoutes);

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
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runIngestion(env)
        .then((result) => {
          console.log(JSON.stringify({ message: "ingestion run complete", ...result }));
        })
        .catch((err) => {
          // See CLAUDE.md's "Ingestion health monitoring" note: a silent
          // failure here is exactly the risk of depending on one OAuth token
          // forever. This at minimum needs a real alert before this project
          // is trusted to run unattended — tracked as follow-up, not v1.
          console.error(JSON.stringify({ message: "ingestion run FAILED", error: String(err) }));
        }),
    );
  },
};
