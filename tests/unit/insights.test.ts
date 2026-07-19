import {
  buildMonthlyRecap,
  computeMeaningfulAchievements,
  getLevelProgress,
} from "@/lib/journal/insights";
import type { PlaceSummary, Review, Stats, Visit } from "@/types";

const stats: Stats = {
  total_visits: 4,
  unique_pois_visited: 3,
  total_reviews: 2,
  total_photos: 5,
  total_distance_km: 0,
  total_xp: 120,
  level: 2,
  current_streak: 0,
  steps_today: 0,
  steps_weekly_avg: 0,
  updated_at: "2026-07-19",
};

function visit(id: string, poiId: string, category: Visit["poi_category"], arrivedAt: string, mood?: string): Visit {
  return {
    id,
    poi_id: poiId,
    poi_name: `장소 ${poiId}`,
    poi_category: category,
    arrived_at: arrivedAt,
    latitude: 37.5,
    longitude: 127,
    mood,
    photo_ids: id === "v1" ? ["photo-a.jpg"] : [],
    xp_earned: 10,
    xp_breakdown: { base_visit: 10, first_visit_bonus: 0, review_bonus: 0, photo_bonus: 0, streak_bonus: 0 },
    created_at: arrivedAt,
  };
}

const visits = [
  visit("v1", "a", "cultural_heritage", "2026-07-19T08:00:00.000Z", "calm"),
  visit("v2", "a", "cultural_heritage", "2026-07-18T08:00:00.000Z", "calm"),
  visit("v3", "b", "nature", "2026-07-17T08:00:00.000Z", "curious"),
  visit("v4", "c", "food", "2026-06-17T08:00:00.000Z", "focused"),
];

const reviews: Review[] = [
  {
    id: "r1",
    poi_id: "a",
    poi_name: "장소 a",
    visit_id: "v1",
    rating: 5,
    text: "좋았다",
    tags: [],
    photo_ids: ["photo-b.jpg"],
    is_shared: false,
    created_at: "2026-07-19T09:00:00.000Z",
  },
];

const places = Array.from({ length: 5 }, (_, index): PlaceSummary => ({
  id: `place-${index}`,
  name: `저장 장소 ${index}`,
  category: "historic_site",
  latitude: 37.5,
  longitude: 127,
  geofence_radius_m: 50,
  region: "서울",
  district: "종로",
  source: "dummy",
  base_xp: 10,
  is_saved: true,
  is_visited: false,
  visit_count: 0,
  tags: [],
}));

describe("journal insights", () => {
  it("earns only achievements whose real thresholds are met", () => {
    const achievements = computeMeaningfulAchievements({ stats, places, visits, reviews });

    expect(achievements.find((item) => item.id === "first-footprint")?.earned).toBe(true);
    expect(achievements.find((item) => item.id === "three-perspectives")?.earned).toBe(true);
    expect(achievements.find((item) => item.id === "saved-constellation")?.earned).toBe(true);
    expect(achievements.find((item) => item.id === "thoughtful-notes")).toMatchObject({
      current: 2,
      target: 5,
      earned: false,
      progress: 0.4,
    });
    expect(achievements.find((item) => item.id === "photo-trail")?.earned).toBe(true);
  });

  it("builds a truthful monthly recap from visits in that month", () => {
    const recap = buildMonthlyRecap(visits, reviews, new Date("2026-07-20T00:00:00.000Z"));

    expect(recap).toMatchObject({
      monthLabel: "2026년 7월",
      visitCount: 3,
      uniquePlaceCount: 2,
      reviewCount: 1,
      uniquePhotoCount: 2,
      topMood: "calm",
      mostVisitedPlace: "장소 a",
    });
    expect(buildMonthlyRecap(visits, reviews, new Date("2027-01-01T00:00:00.000Z"))).toBeNull();
  });

  it("reports progress to the next level without overstating it", () => {
    expect(getLevelProgress(120)).toEqual({
      level: 2,
      currentThreshold: 100,
      nextThreshold: 250,
      xpToNext: 130,
      progress: 20 / 150,
    });
  });
});
