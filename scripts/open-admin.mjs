#!/usr/bin/env node
// `npm run admin` — opens a browser straight into a logged-in admin session
// for local dev, instead of typing the admin passphrase into /login by hand.
// Only the server can set the session cookie a browser needs, so this just
// points a browser at worker/routes/auth.ts's /dev-login route with the
// token from .dev.vars — see that route's comment for why it's safely inert
// against every real deployment.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DEV_VARS_PATH = ".dev.vars";
const DEV_SERVER_URL = "http://localhost:5173";

if (!existsSync(DEV_VARS_PATH)) {
  console.error(`Missing ${DEV_VARS_PATH} — copy .dev.vars.example to ${DEV_VARS_PATH} first.`);
  process.exit(1);
}

const vars = Object.fromEntries(
  readFileSync(DEV_VARS_PATH, "utf8")
    .split("\n")
    .map((line) => /^([A-Z_]+)=(.*)$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2]]),
);

if (!vars.DEV_LOGIN_TOKEN) {
  console.error(
    `DEV_LOGIN_TOKEN is not set in ${DEV_VARS_PATH} — add one (any random string), then re-run \`npm run cf-typegen\`.`,
  );
  process.exit(1);
}

try {
  await fetch(DEV_SERVER_URL);
} catch {
  console.error(`No dev server responding at ${DEV_SERVER_URL} — start one with \`npm run dev\` first.`);
  process.exit(1);
}

const url = `${DEV_SERVER_URL}/api/dev-login?token=${encodeURIComponent(vars.DEV_LOGIN_TOKEN)}`;

const [command, args] =
  process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];

try {
  execFileSync(command, args);
  console.log(`Opened ${url}`);
} catch {
  console.log(`Couldn't open a browser automatically — visit this URL yourself:\n${url}`);
}
