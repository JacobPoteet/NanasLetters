import { describe, expect, it } from "vitest";
import { adjacentTick, clamp01, fisheye, inverseFisheye, listFractionAtScroll, pointerFraction, tickAtFraction } from "./timeScrubber";
import type { ScrubberTick } from "./timeScrubber";

const ticks: ScrubberTick[] = [
  { key: "2024-03", year: 2024, month: 3, fraction: 0 },
  { key: "2024-02", year: 2024, month: 2, fraction: 0.1 },
  { key: "2023-12", year: 2023, month: 12, fraction: 0.5 },
];

describe("tickAtFraction", () => {
  it("returns the month a fraction falls inside", () => {
    expect(tickAtFraction(ticks, 0.3)?.key).toBe("2024-02");
  });

  it("returns a month when the fraction sits exactly on its start", () => {
    expect(tickAtFraction(ticks, 0.5)?.key).toBe("2023-12");
  });

  it("returns the first month for a fraction at the top and the last past the end", () => {
    expect(tickAtFraction(ticks, 0)?.key).toBe("2024-03");
    expect(tickAtFraction(ticks, 1)?.key).toBe("2023-12");
  });

  it("returns null with no ticks", () => {
    expect(tickAtFraction([], 0.5)).toBeNull();
  });
});

describe("listFractionAtScroll", () => {
  it("measures from the list's top and clamps to 0-1", () => {
    expect(listFractionAtScroll(0, 800, 400, 10000)).toBe(0);
    expect(listFractionAtScroll(5200, 800, 400, 10000)).toBeCloseTo(0.5);
    expect(listFractionAtScroll(99999, 800, 400, 10000)).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(listFractionAtScroll(100, 800, 0, 0)).toBe(0);
  });
});

describe("pointerFraction", () => {
  it("maps a pointer on the rail and clamps outside it", () => {
    expect(pointerFraction(300, 100, 400)).toBe(0.5);
    expect(pointerFraction(50, 100, 400)).toBe(0);
    expect(pointerFraction(900, 100, 400)).toBe(1);
  });
});

describe("adjacentTick", () => {
  it("steps older and newer, clamping at both ends", () => {
    expect(adjacentTick(ticks, "2024-02", 1)?.key).toBe("2023-12");
    expect(adjacentTick(ticks, "2024-02", -1)?.key).toBe("2024-03");
    expect(adjacentTick(ticks, "2023-12", 1)?.key).toBe("2023-12");
    expect(adjacentTick(ticks, "2024-03", -1)?.key).toBe("2024-03");
  });

  it("starts from the newest month when the current one is unknown", () => {
    expect(adjacentTick(ticks, null, 1)?.key).toBe("2024-03");
  });
});

describe("clamp01", () => {
  it("bounds a value to 0-1", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe("fisheye", () => {
  it("is the identity with no magnification", () => {
    expect(fisheye(120, 300, 600, 0)).toBe(120);
  });

  it("leaves the focus and both ends of the rail where they are", () => {
    expect(fisheye(300, 300, 600, 6)).toBeCloseTo(300);
    expect(fisheye(0, 300, 600, 6)).toBeCloseTo(0);
    expect(fisheye(600, 300, 600, 6)).toBeCloseTo(600);
  });

  it("spreads points near the focus apart and stays monotone", () => {
    const near = fisheye(310, 300, 600, 6) - fisheye(300, 300, 600, 6);
    expect(near).toBeGreaterThan(10 * 5);
    let last = -1;
    for (let x = 0; x <= 600; x += 5) {
      const y = fisheye(x, 300, 600, 6);
      expect(y).toBeGreaterThan(last);
      last = y;
    }
  });

  it("handles a focus at either end", () => {
    expect(fisheye(50, 0, 600, 6)).toBeGreaterThan(50);
    expect(fisheye(550, 600, 600, 6)).toBeLessThan(550);
  });

  it("round-trips through its inverse", () => {
    for (const x of [0, 40, 299, 300, 350, 599]) {
      expect(inverseFisheye(fisheye(x, 180, 600, 6), 180, 600, 6)).toBeCloseTo(x);
    }
  });
});
