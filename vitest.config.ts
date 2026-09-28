// Separate from vite.config.ts so tests don't load the Cloudflare plugin — every
// pure fold here (parsing, auth tokens, on-this-day date matching) is plain
// TypeScript and runs fine in Node.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["worker/**/*.test.ts", "shared/**/*.test.ts"],
  },
});
