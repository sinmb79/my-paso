import {
  createVisit,
  getAllPOIs,
  getPOIs,
  getRecentVisits,
} from "@/lib/db/queries";
import { destroyDatabase, initializeDatabase } from "@/lib/db/sqlite";
import { loadSeedPOIs } from "@/lib/poi/seed-loader";

describe("loadSeedPOIs", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-seed-test");
  });

  it("loads 100 licensed Wikidata POIs without a runtime API key", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-seed-test",
      persistent: false,
    });

    const inserted = await loadSeedPOIs(database);
    const pois = await getPOIs(database);

    expect(inserted).toBe(100);
    expect(pois).toHaveLength(100);
    expect(pois.every((poi) => /^wikidata:Q\d+$/.test(poi.source))).toBe(true);
    expect(pois.some((poi) => /테스트|dummy/i.test(poi.name))).toBe(false);
  });

  it("replaces discovery data while preserving legacy alpha visit history", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-seed-test",
      persistent: false,
    });

    await database.sqlite3.execWithParams(
      database.db,
      `
        INSERT INTO pois (
          id, name, category, latitude, longitude, geofence_radius_m,
          region, district, source, base_xp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        "dummy-poi-legacy",
        "테스트 문화유산 legacy",
        "cultural_heritage",
        37.5665,
        126.978,
        50,
        "서울",
        "중구",
        "dummy",
        10,
      ],
    );
    await createVisit(database, {
      poiId: "dummy-poi-legacy",
      arrivedAt: "2026-07-19T00:00:00.000Z",
      latitude: 37.5665,
      longitude: 126.978,
    });

    await loadSeedPOIs(database);

    const discoverable = await getPOIs(database, -1);
    const preserved = await getAllPOIs(database);
    const visits = await getRecentVisits(database, 10);

    expect(discoverable).toHaveLength(100);
    expect(discoverable.some((poi) => poi.source === "dummy")).toBe(false);
    expect(preserved).toHaveLength(101);
    expect(preserved.some((poi) => poi.id === "dummy-poi-legacy")).toBe(true);
    expect(visits[0]).toMatchObject({
      poi_id: "dummy-poi-legacy",
      poi_name: "테스트 문화유산 legacy",
    });
  });
});
