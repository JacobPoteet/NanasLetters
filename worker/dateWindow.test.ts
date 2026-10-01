import { describe, expect, it } from "vitest";
import { nearbyMonthDays, shiftDate, todayMonthDay } from "./dateWindow";

describe("nearbyMonthDays", () => {
  it("returns days on both sides, nearest first", () => {
    expect(nearbyMonthDays("06-15", 2)).toEqual(["06-14", "06-16", "06-13", "06-17"]);
  });

  it("wraps forward across a month boundary", () => {
    expect(nearbyMonthDays("01-01", 3)).toEqual(["12-31", "01-02", "12-30", "01-03", "12-29", "01-04"]);
  });

  it("wraps backward across a month boundary", () => {
    expect(nearbyMonthDays("12-31", 2)).toEqual(["12-30", "01-01", "12-29", "01-02"]);
  });

  it("handles the Feb 29 edge without throwing, using a leap year internally", () => {
    expect(nearbyMonthDays("02-28", 2)).toEqual(["02-27", "02-29", "02-26", "03-01"]);
  });
});

describe("todayMonthDay", () => {
  it("formats a date as zero-padded MM-DD", () => {
    expect(todayMonthDay(new Date(Date.UTC(2026, 0, 5, 12)))).toBe("01-05");
    expect(todayMonthDay(new Date(Date.UTC(2026, 8, 27, 12)))).toBe("09-27");
    expect(todayMonthDay(new Date(Date.UTC(2026, 9, 1, 1)))).toBe("09-30");
  });
});

describe("shiftDate", () => {
  it("shifts backward and forward within a month", () => {
    expect(shiftDate("2026-09-27", -1)).toBe("2026-09-26");
    expect(shiftDate("2026-09-27", 1)).toBe("2026-09-28");
  });

  it("rolls over a month and year boundary", () => {
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});
