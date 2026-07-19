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
import { loadSeedPOIs } from "@/lib/poi/seed-loader";

describe("journal queries", () => {
  beforeEach(async () => {
    await destroyDatabase("paso-journal-test");
  });

  it("records a local visit, awards xp, and updates profile stats", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-journal-test",
      persistent: false,
    });

    await loadSeedPOIs(database);
    const [poi] = await getPOIs(database, 1);

    const visit = await createVisit(database, {
      poiId: poi.id,
      arrivedAt: "2026-04-08T09:00:00.000Z",
      departedAt: "2026-04-08T09:14:00.000Z",
      dwellTimeMinutes: 14,
      latitude: poi.latitude,
      longitude: poi.longitude,
      gpsAccuracyM: 18,
      memo: "첫 로컬 발자국을 남겼다.",
      mood: "curious",
    });

    const profile = await getProfile(database);
    const stats = await getStats(database);
    const recentVisits = await getRecentVisits(database, 5);

    expect(visit.xp_earned).toBe(poi.base_xp + 10);
    expect(visit.xp_breakdown.first_visit_bonus).toBe(10);
    expect(profile.total_xp).toBe(visit.xp_earned);
    expect(stats.total_visits).toBe(1);
    expect(stats.unique_pois_visited).toBe(1);
    expect(stats.total_xp).toBe(visit.xp_earned);
    expect(recentVisits[0]?.memo).toBe("첫 로컬 발자국을 남겼다.");
  });

  it("stores a review for a recorded visit and surfaces it in the journal feed", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-journal-test",
      persistent: false,
    });

    await loadSeedPOIs(database);
    const [poi] = await getPOIs(database, 1);
    const visit = await createVisit(database, {
      poiId: poi.id,
      arrivedAt: "2026-04-08T10:00:00.000Z",
      departedAt: "2026-04-08T10:08:00.000Z",
      dwellTimeMinutes: 8,
      latitude: poi.latitude,
      longitude: poi.longitude,
      gpsAccuracyM: 12,
      memo: "기록 후 바로 리뷰 작성",
      mood: "focused",
    });

    const review = await createReview(database, {
      poiId: poi.id,
      visitId: visit.id,
      rating: 5,
      text: "더미 시드 기반이어도 실제 흐름 검증이 된다.",
      tags: ["dummy-seed", "phase0"],
    });

    const stats = await getStats(database);
    const recentReviews = await getRecentReviews(database, 5);

    expect(review.rating).toBe(5);
    expect(review.tags).toEqual(["dummy-seed", "phase0"]);
    expect(stats.total_reviews).toBe(1);
    expect(recentReviews[0]?.text).toContain("실제 흐름 검증");
  });

  it("keeps saved state and tags separate from seed POIs and searches both", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-journal-test",
      persistent: false,
    });

    await loadSeedPOIs(database);
    const [poi] = await getPOIs(database, 1);
    await setPOISaved(database, poi.id, true);
    await setPOITags(database, poi.id, ["아이와", "다시 갈 곳", "아이와"]);

    const saved = await getPlaceSummaries(database, { state: "saved" });
    const tagged = await getPlaceSummaries(database, { query: "다시 갈 곳" });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: poi.id,
      is_saved: true,
      is_visited: false,
      visit_count: 0,
      tags: ["아이와", "다시 갈 곳"],
    });
    expect(tagged.map((place) => place.id)).toContain(poi.id);

    const seedRow = await database.sqlite3.execWithParams(
      database.db,
      "SELECT name, source FROM pois WHERE id = ?;",
      [poi.id],
    );
    expect(seedRow.rows[0]).toEqual([poi.name, poi.source]);
  });

  it("derives visited state and supports text and state filters", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-journal-test",
      persistent: false,
    });

    await loadSeedPOIs(database);
    const [poi] = await getPOIs(database, 1);
    await createVisit(database, {
      poiId: poi.id,
      arrivedAt: "2026-07-19T08:00:00.000Z",
      latitude: poi.latitude,
      longitude: poi.longitude,
    });

    const visited = await getPlaceSummaries(database, { state: "visited" });
    const searched = await getPlaceSummaries(database, {
      query: poi.name.slice(0, 3),
    });

    expect(visited).toHaveLength(1);
    expect(visited[0]).toMatchObject({
      id: poi.id,
      is_visited: true,
      visit_count: 1,
      last_visited_at: "2026-07-19T08:00:00.000Z",
    });
    expect(searched.map((place) => place.id)).toContain(poi.id);
  });

  it("stores visit photo ids, counts unique photos, and awards one photo bonus", async () => {
    const database = await initializeDatabase({
      databaseName: "paso-journal-test",
      persistent: false,
    });

    await loadSeedPOIs(database);
    const [poi] = await getPOIs(database, 1);
    const visit = await createVisit(database, {
      poiId: poi.id,
      arrivedAt: "2026-07-19T09:00:00.000Z",
      latitude: poi.latitude,
      longitude: poi.longitude,
      photoIds: ["photo-one.jpg", "photo-two.jpg"],
    });
    const stats = await getStats(database);

    expect(visit.photo_ids).toEqual(["photo-one.jpg", "photo-two.jpg"]);
    expect(visit.verification_mode).toBe("manual");
    expect(visit.xp_breakdown.photo_bonus).toBe(5);
    expect(stats.total_photos).toBe(2);
  });
});
