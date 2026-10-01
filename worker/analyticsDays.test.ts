import { describe, expect, it } from "vitest";
import { bucketVisitsByDay, countNewDevicesOn, countOnDay, daysBetween } from "./analyticsDays";

describe("bucketVisitsByDay", () => {
  it("puts a 9pm Eastern visit on the Eastern day, not the next UTC day", () => {
    // 2026-10-01 01:00 UTC is 2026-09-30 9pm EDT.
    const rows = [
      { created_at: "2026-10-01 01:00:00", device_id: "a" },
      { created_at: "2026-09-30 15:00:00", device_id: "b" },
      { created_at: "2026-10-01 14:00:00", device_id: "a" },
    ];
    expect(bucketVisitsByDay(rows, "2026-09-01")).toEqual([
      { day: "2026-09-30", visits: 2, devices: 2 },
      { day: "2026-10-01", visits: 1, devices: 1 },
    ]);
  });

  it("drops days before the window", () => {
    expect(bucketVisitsByDay([{ created_at: "2026-08-01 12:00:00", device_id: "a" }], "2026-09-01")).toEqual([]);
  });
});

describe("countNewDevicesOn", () => {
  it("counts by Eastern day", () => {
    expect(countNewDevicesOn([{ first_at: "2026-10-01 01:00:00" }, { first_at: "2026-10-01 15:00:00" }], "2026-09-30")).toBe(1);
  });
});

describe("countOnDay", () => {
  it("counts by Eastern day", () => {
    const ts = ["2026-10-01 01:00:00", "2026-09-30 13:00:00", "2026-10-01 13:00:00"];
    expect(countOnDay(ts, "2026-09-30")).toBe(2);
  });
});

describe("daysBetween", () => {
  it("counts whole days across a month boundary", () => {
    expect(daysBetween("2026-09-28", "2026-10-01")).toBe(3);
    expect(daysBetween("2026-09-30", "2026-09-30")).toBe(0);
  });
});
