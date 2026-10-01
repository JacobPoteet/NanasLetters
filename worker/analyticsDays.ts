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
