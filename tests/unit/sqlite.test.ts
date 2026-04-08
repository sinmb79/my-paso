import { destroyDatabase, initializeDatabase } from "@/lib/db/sqlite";

describe("initializeDatabase", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-sqlite-test");
  });

  it("creates the core local-first tables", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-sqlite-test",
      persistent: false,
    });

    const tables = await database.sqlite3.execWithParams(
      database.db,
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name IN ('pois', 'visits', 'reviews', 'xp_log', 'stats')
        ORDER BY name;
      `,
    );

    expect(tables.rows).toEqual([
      ["pois"],
      ["reviews"],
      ["stats"],
      ["visits"],
      ["xp_log"],
    ]);
  });
});
