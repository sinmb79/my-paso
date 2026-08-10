import {
  exportPasoSnapshot,
  inspectPasoSnapshot,
  restorePasoSnapshot,
} from "@/lib/export/json-export";
import {
  createReview,
  createVisit,
  getPOIs,
  getPlaceSummaries,
  getProfile,
  getRecentReviews,
  getRecentVisits,
  getStats,
  setPOISaved,
  setPOITags,
} from "@/lib/db/queries";
import { destroyDatabase, initializeDatabase } from "@/lib/db/sqlite";
import { executeStatementsOrThrow } from "@/lib/db/transaction";
import { loadSeedPOIs } from "@/lib/poi/seed-loader";
import {
  clearJournalPhotos,
  deleteJournalPhoto,
  getJournalPhotoUrl,
  saveJournalPhoto,
} from "@/lib/media/photo-store";

describe("json snapshot restore", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-export-source");
    await destroyDatabase("paso-export-target");
    await clearJournalPhotos();
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
    const storedPhoto = await saveJournalPhoto(
      "data:image/jpeg;base64,cGFzby1iYWNrdXAtcGhvdG8=",
    );

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
      photoIds: [storedPhoto.id],
    });

    await createReview(source, {
      poiId: seedPoi.id,
      visitId: visit.id,
      rating: 4,
      text: "Snapshot restore keeps review history intact.",
      tags: ["restore", "snapshot"],
    });
    await setPOISaved(source, seedPoi.id, true);
    await setPOITags(source, seedPoi.id, ["가족과", "다시 방문"]);

    const snapshot = await exportPasoSnapshot(source);
    await deleteJournalPhoto(storedPhoto.id);

    expect(snapshot.app_version).toBe("0.3.0");
    await restorePasoSnapshot(target, snapshot);

    const profile = await getProfile(target);
    const stats = await getStats(target);
    const visits = await getRecentVisits(target, 5);
    const reviews = await getRecentReviews(target, 5);
    const savedPlaces = await getPlaceSummaries(target, { state: "saved" });

    expect(profile.total_xp).toBe(snapshot.profile.total_xp);
    expect(stats.total_reviews).toBe(1);
    expect(visits[0]?.memo).toBe("Restorable visit");
    expect(reviews[0]?.tags).toEqual(["restore", "snapshot"]);
    expect(snapshot.place_collections).toHaveLength(1);
    expect(snapshot.media).toEqual([
      expect.objectContaining({ id: storedPhoto.id }),
    ]);
    expect(snapshot.record_counts?.media).toBe(1);
    await expect(getJournalPhotoUrl(storedPhoto.id)).resolves.toBe(
      "data:image/jpeg;base64,cGFzby1iYWNrdXAtcGhvdG8=",
    );
    expect(snapshot.record_counts?.place_collections).toBe(1);
    expect(savedPlaces[0]).toMatchObject({
      id: seedPoi.id,
      is_saved: true,
      tags: ["가족과", "다시 방문"],
    });
  });

  it("exports every visit instead of truncating history at 100 records", async () => {
    const source = await initializeDatabase({
      databaseName: "paso-export-source",
      persistent: false,
    });

    await loadSeedPOIs(source);
    const [seedPoi] = await getPOIs(source, 1);
    const visits = Array.from({ length: 125 }, (_, index) => ({
      id: `visit-bulk-${String(index).padStart(3, "0")}`,
      arrivedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));

    await executeStatementsOrThrow(
      source,
      `
        INSERT INTO visits (
          id, poi_id, arrived_at, latitude, longitude, photo_ids,
          xp_earned, xp_breakdown_json, created_at
        ) VALUES (?, ?, ?, ?, ?, '[]', 0, '{}', ?);
      `,
      visits.map((visit) => [
        visit.id,
        seedPoi.id,
        visit.arrivedAt,
        seedPoi.latitude,
        seedPoi.longitude,
        visit.arrivedAt,
      ]),
    );

    const snapshot = await exportPasoSnapshot(source);
    const inspection = await inspectPasoSnapshot(snapshot);

    expect(snapshot.visits).toHaveLength(125);
    expect(snapshot.record_counts?.visits).toBe(125);
    expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(inspection.valid).toBe(true);
  });

  it("rejects a damaged backup before changing existing data", async () => {
    const source = await initializeDatabase({
      databaseName: "paso-export-source",
      persistent: false,
    });
    const target = await initializeDatabase({
      databaseName: "paso-export-target",
      persistent: false,
    });

    await loadSeedPOIs(source);
    await loadSeedPOIs(target);
    const [sourcePoi] = await getPOIs(source, 1);
    const [targetPoi] = await getPOIs(target, 1);

    await createVisit(source, {
      poiId: sourcePoi.id,
      arrivedAt: "2026-04-08T12:00:00.000Z",
      latitude: sourcePoi.latitude,
      longitude: sourcePoi.longitude,
    });
    const targetVisit = await createVisit(target, {
      poiId: targetPoi.id,
      arrivedAt: "2026-04-09T12:00:00.000Z",
      latitude: targetPoi.latitude,
      longitude: targetPoi.longitude,
      memo: "must survive invalid restore",
    });

    const snapshot = await exportPasoSnapshot(source);
    const damagedSnapshot = {
      ...snapshot,
      visits: snapshot.visits.map((visit, index) =>
        index === 0 ? { ...visit, poi_id: "missing-poi" } : visit,
      ),
    };

    const inspection = await inspectPasoSnapshot(damagedSnapshot);
    expect(inspection.valid).toBe(false);
    await expect(restorePasoSnapshot(target, damagedSnapshot)).rejects.toThrow(
      "Backup validation failed",
    );

    const visitsAfterFailure = await getRecentVisits(target, 10);
    expect(visitsAfterFailure).toHaveLength(1);
    expect(visitsAfterFailure[0]?.id).toBe(targetVisit.id);
    expect(visitsAfterFailure[0]?.memo).toBe("must survive invalid restore");
  });

  it("rolls back the restore transaction when insertion fails", async () => {
    const source = await initializeDatabase({
      databaseName: "paso-export-source",
      persistent: false,
    });
    const target = await initializeDatabase({
      databaseName: "paso-export-target",
      persistent: false,
    });

    await loadSeedPOIs(source);
    await loadSeedPOIs(target);
    const [sourcePoi] = await getPOIs(source, 1);
    const [targetPoi] = await getPOIs(target, 1);

    await createVisit(source, {
      poiId: sourcePoi.id,
      arrivedAt: "2026-04-08T12:00:00.000Z",
      latitude: sourcePoi.latitude,
      longitude: sourcePoi.longitude,
    });
    const targetVisit = await createVisit(target, {
      poiId: targetPoi.id,
      arrivedAt: "2026-04-09T12:00:00.000Z",
      latitude: targetPoi.latitude,
      longitude: targetPoi.longitude,
      memo: "must survive rollback",
    });

    const snapshot = await exportPasoSnapshot(source);
    await target.sqlite3.exec(
      target.db,
      `
        CREATE TRIGGER fail_snapshot_restore
        BEFORE INSERT ON visits
        BEGIN
          SELECT RAISE(ABORT, 'forced restore failure');
        END;
      `,
    );

    await expect(restorePasoSnapshot(target, snapshot)).rejects.toThrow(
      "forced restore failure",
    );

    const visitsAfterFailure = await getRecentVisits(target, 10);
    expect(visitsAfterFailure).toHaveLength(1);
    expect(visitsAfterFailure[0]?.id).toBe(targetVisit.id);
    expect(visitsAfterFailure[0]?.memo).toBe("must survive rollback");
  });
});
