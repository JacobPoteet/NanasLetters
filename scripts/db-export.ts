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
// the virtual table at all.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { BACKUP_TABLES, buildBackupSql, type TableDump } from "../worker/backup";

// `npx` resolves to `npx.cmd` on Windows, a batch file Node can only launch
// through a shell (`shell: true`) — even naming `npx.cmd` explicitly still
// fails (spawnSync EINVAL) without it. `--file` instead of `--command` was
// tried to sidestep the quoting question entirely, but wrangler treats a
// `--file` execution as a batch import: it returns summary stats ("Rows
// read", "Database size"), never the actual row data, so it's unusable here.
//
// With `shell: true`, Node joins [file, ...args] into one string for cmd.exe
// without quoting anything itself (confirmed: an unquoted multi-word SQL
// string got split into separate positional args) — so the SQL argument is
// quoted here, by hand, before it reaches the array. Safe to do plainly
// (no escaping beyond the wrapping quotes) because every value passed
// through this path is one of the fixed, hardcoded SELECT statements built
// from BACKUP_TABLES below — never anything derived from user input.
function queryTable(table: string, columns: string[]): Record<string, unknown>[] {
  const sql = `SELECT ${columns.join(", ")} FROM ${table}`;
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "nanas-letters-db", "--remote", "--json", "--command", `"${sql}"`],
    // `letters` alone is already past Node's 1MB default maxBuffer once every
    // letter's full text comes back in one JSON blob — this whole database
    // is still nowhere near 100MB, so there's plenty of headroom here.
    { encoding: "utf8", shell: true, maxBuffer: 100 * 1024 * 1024 },
  );
  const [result] = JSON.parse(output) as { results: Record<string, unknown>[] }[];
  return result.results;
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
