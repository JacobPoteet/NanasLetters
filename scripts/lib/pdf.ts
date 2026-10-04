// Prints the archive's per-year HTML to PDF with a locally installed Chromium
// browser (Chrome, Edge, Chromium), driven by puppeteer-core — which downloads
// nothing, so there's no browser binary in this repo's dependencies. Set
// ARCHIVE_BROWSER to a browser executable to override the search.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findBrowser(): string | null {
  const fromEnv = process.env.ARCHIVE_BROWSER;
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/** `pages` maps an output path (relative to archiveDir) to the HTML to print; the HTML's relative photo paths resolve against archiveDir. */
export async function printPdfs(archiveDir: string, executablePath: string, pages: { out: string; html: string; title: string }[]): Promise<void> {
  // A throwaway profile: without one, a browser that is already open hands the
  // launch to that running instance and exits at once ("Code: 0").
  const userDataDir = mkdtempSync(join(tmpdir(), "nanas-archive-"));
  const browser = await puppeteer.launch({ executablePath, headless: true, userDataDir, protocolTimeout: 600_000 });
  try {
    for (const { out, html } of pages) {
      // Written beside the photos so their relative paths resolve; removed right after.
      const temp = join(archiveDir, ".print-temp.html");
      writeFileSync(temp, html);
      const page = await browser.newPage();
      try {
        await page.goto(pathToFileURL(resolve(temp)).href, { waitUntil: "load", timeout: 600_000 });
        await page.pdf({
          path: join(archiveDir, out),
          format: "Letter",
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: "<span></span>",
          footerTemplate:
            '<div style="font-size:8px;color:#6b5f4f;width:100%;text-align:center;font-family:serif"><span class="pageNumber"></span></div>',
          margin: { top: "0.9in", bottom: "0.9in", left: "1in", right: "1in" },
          timeout: 600_000,
        });
      } finally {
        await page.close();
        rmSync(temp, { force: true });
      }
    }
  } finally {
    await browser.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
}
