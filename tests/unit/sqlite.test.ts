import { destroyDatabase, initializeDatabase } from "@/lib/db/sqlite";

describe("initializeDatabase", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-sqlite-test");
  });

  it("creates versioned core and user-owned place tables", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-sqlite-test",
      persistent: false,
    });

    const tables = await database.sqlite3.execWithParams(
      database.db,
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name IN (
          'pois', 'visits', 'reviews', 'xp_log', 'stats',
          'schema_migrations', 'poi_user_state', 'tags', 'poi_tags'
        )
        ORDER BY name;
      `,
    );

    expect(tables.rows).toEqual([
      ["poi_tags"],
      ["poi_user_state"],
      ["pois"],
      ["reviews"],
      ["schema_migrations"],
      ["stats"],
      ["tags"],
      ["visits"],
      ["xp_log"],
    ]);

    const migrations = await database.sqlite3.execWithParams(
      database.db,
      "SELECT version FROM schema_migrations ORDER BY version;",
    );
    expect(migrations.rows).toEqual([[1], [2], [3]]);
  });
});
