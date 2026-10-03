import { execFileSync } from "node:child_process";

// See scripts/db-export.ts for why this goes through `npx` with
// `shell: true` and a hand-quoted SQL argument. Only ever called with fixed,
// hardcoded SELECT statements — never anything derived from user input.
export function queryRemote<T = Record<string, unknown>>(sql: string): T[] {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "nanas-letters-db", "--remote", "--json", "--command", `"${sql}"`],
    { encoding: "utf8", shell: true, maxBuffer: 100 * 1024 * 1024 },
  );
  const [result] = JSON.parse(output) as { results: T[] }[];
  return result.results;
}
