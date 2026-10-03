#!/usr/bin/env node
// Builds a human-readable, software-independent copy of the whole archive
// under archives/NanasLetters-Archive-<date>/ — plain text per letter, one
// combined text file, JSON, photos, and a checksum manifest. Read-only
// against prod: SELECTs through wrangler plus `r2 object get`; nothing is
// ever written back. Runs on this machine, not in the Worker, so exporting
// costs no Worker CPU and no R2 egress beyond the photo reads themselves.
//
// Formats and their pure folds live in shared/archive.ts. Re-runnable: each
// run is stamped with its own date, so successive archives sit side by side.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { queryRemote } from "./lib/d1";
import {
  assignFileNames,
  buildArchiveJson,
  buildReadme,
  formatAllLettersText,
  formatChecksums,
  formatLetterText,
  photoFileName,
  type ArchiveComment,
  type ArchiveLetter,
} from "../shared/archive";

const PHOTO_BUCKET = "nanas-letters-photos";

interface LetterRow {
  id: number;
  date: string;
  text: string;
  meditation_title: string | null;
  meditation_url: string | null;
}
interface PhotoRow {
  letter_id: number;
  r2_key: string;
  mime_type: string;
  caption: string | null;
}
interface CommentRow {
  letter_id: number;
  author_name: string | null;
  body: string;
  created_at: string;
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, [...(map.get(k) ?? []), row]);
  }
  return map;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const generatedAt = new Date().toISOString();
const outDir = join("archives", `NanasLetters-Archive-${generatedAt.slice(0, 10)}`);

console.log("Reading letters, photos and comments from prod...");
const letterRows = queryRemote<LetterRow>("SELECT id, date, text, meditation_title, meditation_url FROM letters");
const photoRows = queryRemote<PhotoRow>("SELECT letter_id, r2_key, mime_type, caption FROM letter_photos ORDER BY id");
// Deleted comments are the admin's moderation decisions and stay out; device
// ids and IP hashes are never selected.
const commentRows = queryRemote<CommentRow>(
  "SELECT letter_id, author_name, body, created_at FROM comments WHERE status = 'visible' ORDER BY created_at, id",
);

if (letterRows.length === 0) throw new Error("Prod returned zero letters; refusing to write an empty archive.");

const photosByLetter = groupBy(photoRows, (p) => p.letter_id);
const commentsByLetter = groupBy(commentRows, (c) => c.letter_id);

const letters: ArchiveLetter[] = assignFileNames(letterRows).map((row) => ({
  id: row.id,
  date: row.date,
  text: row.text,
  meditationTitle: row.meditation_title,
  meditationUrl: row.meditation_url,
  file: row.file,
  photos: (photosByLetter.get(row.id) ?? []).map((p, i) => ({
    r2Key: p.r2_key,
    mimeType: p.mime_type,
    caption: p.caption,
    file: photoFileName(row.date, i, p.mime_type),
  })),
  comments: (commentsByLetter.get(row.id) ?? []).map(
    (c): ArchiveComment => ({ authorName: c.author_name, body: c.body, createdAt: c.created_at }),
  ),
}));

function write(path: string, content: string | Buffer): void {
  const full = join(outDir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

for (const letter of letters) write(letter.file, formatLetterText(letter));
write("all-letters.txt", formatAllLettersText(letters));
write("data/letters.json", buildArchiveJson(letters, generatedAt));

const photos = letters.flatMap((l) => l.photos);
console.log(`Downloading ${photos.length} photos...`);
for (const photo of photos) {
  const dest = join(outDir, photo.file);
  mkdirSync(dirname(dest), { recursive: true });
  // r2_key is a bucket-internal key written by this app's own ingestion, not
  // user input; quoted the same way queryRemote quotes its SQL.
  execFileSync("npx", ["wrangler", "r2", "object", "get", `"${PHOTO_BUCKET}/${photo.r2Key}"`, "--file", `"${dest}"`, "--remote"], {
    shell: true,
    stdio: "ignore",
  });
}

write(
  "README.txt",
  buildReadme({
    generatedAt,
    letterCount: letters.length,
    firstDate: letters[0].date,
    lastDate: letters[letters.length - 1].date,
    commentCount: commentRows.length,
    photoCount: photos.length,
  }),
);

// Last, so the manifest covers every other file.
const entries = listFiles(outDir).map((file) => ({
  path: relative(outDir, file).split("\\").join("/"),
  sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
}));
write("checksums.sha256", formatChecksums(entries));

console.log(`Archived ${letters.length} letters, ${commentRows.length} comments, ${photos.length} photos to ${outDir}`);
