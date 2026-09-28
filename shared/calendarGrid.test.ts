import { describe, expect, it } from "vitest";
import { buildMonthGrid } from "./calendarGrid";

const OPTS = { archiveStart: "2018-02-06", today: "2026-09-28" };

describe("buildMonthGrid", () => {
  it("aligns the first day of the month to its real weekday (Feb 2018 starts on a Thursday)", () => {
    const grid = buildMonthGrid(2018, 2, {}, OPTS);
    // Sun-Sat columns; Thursday is index 4.
    expect(grid.weeks[0][0]).toBeNull();
    expect(grid.weeks[0][4]?.date).toBe("2018-02-01");
  });

  it("includes all 29 days in a leap-year February", () => {
    const grid = buildMonthGrid(2024, 2, {}, { archiveStart: "2018-02-06", today: "2026-09-28" });
    const days = grid.weeks.flat().filter((d): d is NonNullable<typeof d> => d !== null);
    expect(days).toHaveLength(29);
    expect(days.at(-1)?.date).toBe("2024-02-29");
  });

  it("includes only 28 days in a non-leap-year February", () => {
    const grid = buildMonthGrid(2026, 2, {}, OPTS);
    const days = grid.weeks.flat().filter((d): d is NonNullable<typeof d> => d !== null);
    expect(days).toHaveLength(28);
  });

  it("marks a day before the archive start as pre-archive, not a gap", () => {
    const grid = buildMonthGrid(2018, 1, {}, OPTS);
    const jan1 = grid.weeks.flat().find((d) => d?.date === "2018-01-01");
    expect(jan1?.state).toBe("pre-archive");
  });

  it("marks a day at or after today as future, not a gap", () => {
    const grid = buildMonthGrid(2026, 10, {}, OPTS);
    const oct5 = grid.weeks.flat().find((d) => d?.date === "2026-10-05");
    expect(oct5?.state).toBe("future");
  });

  it("marks a real zero-letter day within the archive span as a gap", () => {
    const grid = buildMonthGrid(2026, 9, {}, OPTS);
    const sep10 = grid.weeks.flat().find((d) => d?.date === "2026-09-10");
    expect(sep10?.state).toBe("empty");
    expect(sep10?.count).toBe(0);
  });

  it("counts multiple letters on the same day and still calls it has-letters", () => {
    const grid = buildMonthGrid(2026, 9, { "2026-09-10": [101, 102] }, OPTS);
    const sep10 = grid.weeks.flat().find((d) => d?.date === "2026-09-10");
    expect(sep10?.count).toBe(2);
    expect(sep10?.state).toBe("has-letters");
  });

  it("pads the grid to full weeks of 7 with nulls outside the month", () => {
    const grid = buildMonthGrid(2026, 9, {}, OPTS);
    for (const week of grid.weeks) expect(week).toHaveLength(7);
  });
});
