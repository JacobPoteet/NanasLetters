import { describe, expect, it } from "vitest";
import { escapeHtml, groupByYearMonth, longDate, paragraphsHtml } from "./archiveMarkup";

describe("escapeHtml", () => {
  it("escapes markup characters and drops XML-forbidden control characters", () => {
    expect(escapeHtml(`a<b>&"c"'d\u0001`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;&#39;d");
  });
});

describe("paragraphsHtml", () => {
  it("makes one escaped paragraph per non-empty line", () => {
    expect(paragraphsHtml("one <\r\n\n  two  \n")).toBe("<p>one &lt;</p>\n<p>two</p>");
  });
});

describe("longDate", () => {
  it("formats without timezone drift", () => {
    expect(longDate("2018-02-06")).toBe("Tuesday, February 6, 2018");
  });
});

describe("groupByYearMonth", () => {
  it("groups sorted letters into years and months", () => {
    const g = groupByYearMonth([
      { date: "2018-02-06" },
      { date: "2018-02-07" },
      { date: "2018-04-01" },
      { date: "2019-01-01" },
    ]);
    expect(g.map((y) => [y.year, y.months.map((m) => [m.month, m.letters.length])])).toEqual([
      [2018, [[2, 2], [4, 1]]],
      [2019, [[1, 1]]],
    ]);
  });
  it("returns nothing for no letters", () => {
    expect(groupByYearMonth([])).toEqual([]);
  });
});
