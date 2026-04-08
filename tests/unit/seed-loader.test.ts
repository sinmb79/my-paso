import { getPOIs } from "@/lib/db/queries";
import { destroyDatabase, initializeDatabase } from "@/lib/db/sqlite";
import { loadSeedPOIs } from "@/lib/poi/seed-loader";

describe("loadSeedPOIs", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-seed-test");
  });

  it("loads 100 dummy POIs when live API keys are absent", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-seed-test",
      persistent: false,
    });

    const inserted = await loadSeedPOIs(database);
    const pois = await getPOIs(database);

    expect(inserted).toBe(100);
    expect(pois).toHaveLength(100);
  });
});
