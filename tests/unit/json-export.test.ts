import {
  exportPasoSnapshot,
  restorePasoSnapshot,
} from "@/lib/export/json-export";
import {
  createReview,
  createVisit,
  getPOIs,
  getProfile,
  getRecentReviews,
  getRecentVisits,
  getStats,
} from "@/lib/db/queries";
import { destroyDatabase, initializeDatabase } from "@/lib/db/sqlite";
import { loadSeedPOIs } from "@/lib/poi/seed-loader";

describe("json snapshot restore", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-export-source");
    await destroyDatabase("paso-export-target");
  });

  it("restores a local snapshot into a fresh database", async () => {
    const source = await initializeDatabase({
      databaseName: "paso-export-source",
      persistent: false,
    });
    const target = await initializeDatabase({
      databaseName: "paso-export-target",
      persistent: false,
    });

    await loadSeedPOIs(source);
    const [seedPoi] = await getPOIs(source, 1);

    const visit = await createVisit(source, {
      poiId: seedPoi.id,
      arrivedAt: "2026-04-08T12:00:00.000Z",
      departedAt: "2026-04-08T12:18:00.000Z",
      dwellTimeMinutes: 18,
      latitude: seedPoi.latitude,
      longitude: seedPoi.longitude,
      gpsAccuracyM: 10,
      memo: "Restorable visit",
      mood: "calm",
    });

    await createReview(source, {
      poiId: seedPoi.id,
      visitId: visit.id,
      rating: 4,
      text: "Snapshot restore keeps review history intact.",
      tags: ["restore", "snapshot"],
    });

    const snapshot = await exportPasoSnapshot(source);

    await restorePasoSnapshot(target, snapshot);

    const profile = await getProfile(target);
    const stats = await getStats(target);
    const visits = await getRecentVisits(target, 5);
    const reviews = await getRecentReviews(target, 5);

    expect(profile.total_xp).toBe(snapshot.profile.total_xp);
    expect(stats.total_reviews).toBe(1);
    expect(visits[0]?.memo).toBe("Restorable visit");
    expect(reviews[0]?.tags).toEqual(["restore", "snapshot"]);
  });
});
