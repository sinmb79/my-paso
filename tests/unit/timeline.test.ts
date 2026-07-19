import {
  buildJournalTimeline,
  findOnThisDayMemory,
} from "@/lib/journal/timeline";
import type { Review, Visit } from "@/types";

function visit(id: string, arrivedAt: string): Visit {
  return {
    id,
    poi_id: `poi-${id}`,
    poi_name: `장소 ${id}`,
    poi_category: "historic_site",
    arrived_at: arrivedAt,
    latitude: 37.5,
    longitude: 127,
    photo_ids: [],
    xp_earned: 10,
    xp_breakdown: {
      base_visit: 10,
      first_visit_bonus: 0,
      review_bonus: 0,
      photo_bonus: 0,
      streak_bonus: 0,
    },
    created_at: arrivedAt,
  };
}

function review(visitId: string): Review {
  return {
    id: `review-${visitId}`,
    poi_id: `poi-${visitId}`,
    poi_name: `장소 ${visitId}`,
    visit_id: visitId,
    rating: 5,
    text: "기억에 남는 하루",
    tags: [],
    photo_ids: [],
    is_shared: false,
    created_at: "2026-07-19T10:00:00.000Z",
  };
}

describe("journal timeline", () => {
  it("groups visits by day and attaches reviews", () => {
    const visits = [
      visit("late", "2026-07-19T12:00:00.000Z"),
      visit("early", "2026-07-19T08:00:00.000Z"),
      visit("previous", "2026-07-18T09:00:00.000Z"),
    ];

    const timeline = buildJournalTimeline(visits, [review("late")]);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.dateKey).toBe("2026-07-19");
    expect(timeline[0]?.entries.map((entry) => entry.visit.id)).toEqual([
      "late",
      "early",
    ]);
    expect(timeline[0]?.entries[0]?.review?.text).toBe("기억에 남는 하루");
  });

  it("returns a real anniversary memory only for the same month and day", () => {
    const visits = [
      visit("anniversary", "2025-07-19T08:00:00.000Z"),
      visit("other", "2025-07-18T08:00:00.000Z"),
    ];

    expect(
      findOnThisDayMemory(visits, new Date("2026-07-19T12:00:00.000Z"))?.id,
    ).toBe("anniversary");
    expect(
      findOnThisDayMemory(visits, new Date("2026-08-19T12:00:00.000Z")),
    ).toBeNull();
  });
});
