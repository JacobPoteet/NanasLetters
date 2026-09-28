#!/usr/bin/env node
// Dumps prod D1 to a timestamped, gitignored file under backups/. Run before
// any prod DB work (migrations especially) — see CLAUDE.md's
// "A scheduled, automated backup is not optional polish" note: this is the
// manual habit, not the backup strategy itself.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("backups", { recursive: true });
const output = `backups/prod-${stamp}.sql`;

execFileSync("npx", ["wrangler", "d1", "export", "nanas-letters-db", "--remote", `--output=${output}`], {
  stdio: "inherit",
});

console.log(`Exported to ${output}`);
