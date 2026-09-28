import { describe, expect, it } from "vitest";
import { buildBackupSql } from "./backup";

describe("buildBackupSql", () => {
  it("emits one INSERT per row with explicit columns", () => {
    const sql = buildBackupSql([
      {
        table: "letters",
        columns: ["id", "date", "text"],
        rows: [{ id: 1, date: "2018-02-06", text: "Good morning!" }],
      },
    ]);
    expect(sql).toContain("INSERT INTO letters (id, date, text) VALUES (1, '2018-02-06', 'Good morning!');");
  });

  it("escapes single quotes so a letter's own apostrophes don't break the dump", () => {
    const sql = buildBackupSql([
      { table: "letters", columns: ["id", "text"], rows: [{ id: 1, text: "I couldn't have said it better" }] },
    ]);
    expect(sql).toContain("VALUES (1, 'I couldn''t have said it better');");
  });

  it("writes NULL, not the string 'null', for null/undefined columns", () => {
    const sql = buildBackupSql([
      { table: "letters", columns: ["id", "meditation_url"], rows: [{ id: 1, meditation_url: null }] },
    ]);
    expect(sql).toContain("VALUES (1, NULL);");
  });

  it("skips a table entirely (no header, no INSERTs) when it has no rows", () => {
    const sql = buildBackupSql([{ table: "letter_photos", columns: ["id"], rows: [] }]);
    expect(sql).not.toContain("letter_photos");
  });

  it("includes a row-count header comment per non-empty table", () => {
    const sql = buildBackupSql([
      { table: "letters", columns: ["id"], rows: [{ id: 1 }, { id: 2 }] },
    ]);
    expect(sql).toContain("-- letters (2 rows)");
  });
});
