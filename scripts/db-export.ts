#!/usr/bin/env node
// Dumps prod D1 to a timestamped, gitignored file under backups/. Run before
// any prod DB work (migrations especially) — see CLAUDE.md's "A scheduled,
// automated backup is not optional polish" note: this is the manual habit,
// not the backup strategy itself (that's worker/backup.ts's daily Cron
// Trigger, which writes to R2 from inside the Worker).
//
// Deliberately doesn't shell out to `wrangler d1 export`: it refuses outright
// to export a database with an FTS5 virtual table (`letters_fts`, present
// since migration 0001) — "cannot export databases with Virtual Tables
// (fts5)". Instead this reuses the same plain-SELECT-then-INSERT approach as
// the Worker's own backup (worker/backup.ts's BACKUP_TABLES/buildBackupSql),
// one `wrangler d1 execute --json` call per real table, which never touches
// the virtual table at all. (The wrangler-shelling details live in
// scripts/lib/d1.ts, shared with scripts/archive.ts.)

import { mkdirSync, writeFileSync } from "node:fs";
import { queryRemote } from "./lib/d1";
import { BACKUP_TABLES, buildBackupSql, type TableDump } from "../worker/backup";

function queryTable(table: string, columns: string[]): Record<string, unknown>[] {
  return queryRemote(`SELECT ${columns.join(", ")} FROM ${table}`);
}

mkdirSync("backups", { recursive: true });

const dumps: TableDump[] = BACKUP_TABLES.map(({ table, columns }) => ({
  table,
  columns,
  rows: queryTable(table, columns),
}));

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = `backups/prod-${stamp}.sql`;
writeFileSync(output, `-- Manual D1 export (npm run db:export:remote), generated ${new Date().toISOString()}.\n${buildBackupSql(dumps)}`);

console.log(`Exported to ${output}`);
