// Buckets raw visit timestamps into family-time calendar days. SQLite has no
// DST-aware time zone support, so this folds in JS instead of GROUP BY.

import { familyDayFromSqlite } from "./dateWindow";

export interface VisitRow {
  created_at: string;
  device_id: string;
}

export interface DayBucket {
  day: string;
  visits: number;
  devices: number;
}

export function bucketVisitsByDay(rows: VisitRow[], sinceDay: string): DayBucket[] {
  const byDay = new Map<string, { visits: number; devices: Set<string> }>();
  for (const row of rows) {
    const day = familyDayFromSqlite(row.created_at);
    if (day < sinceDay) continue;
    const bucket = byDay.get(day) ?? { visits: 0, devices: new Set<string>() };
    bucket.visits += 1;
    bucket.devices.add(row.device_id);
    byDay.set(day, bucket);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, b]) => ({ day, visits: b.visits, devices: b.devices.size }));
}

/** Devices whose very first visit (earliest timestamp) falls on `day`. */
export function countNewDevicesOn(firstSeen: { first_at: string }[], day: string): number {
  return firstSeen.filter((r) => familyDayFromSqlite(r.first_at) === day).length;
}

/** How many of the SQLite `datetime('now')` timestamps fall on `day` in family time. */
export function countOnDay(createdAts: string[], day: string): number {
  return createdAts.filter((t) => familyDayFromSqlite(t) === day).length;
}

/** Whole calendar days from `fromDay` to `toDay` (both YYYY-MM-DD). */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}
