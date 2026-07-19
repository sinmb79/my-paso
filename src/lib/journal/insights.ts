import { getLevelForXp, LEVEL_THRESHOLDS } from "@/lib/xp/level-table";
import type { PlaceSummary, Review, Stats, Visit } from "@/types";

export type MeaningfulAchievement = {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  progress: number;
  earned: boolean;
};

type InsightInput = {
  stats: Stats;
  places: PlaceSummary[];
  visits: Visit[];
  reviews: Review[];
};

function achievement(
  id: string,
  title: string,
  description: string,
  current: number,
  target: number,
): MeaningfulAchievement {
  return {
    id,
    title,
    description,
    current,
    target,
    progress: Math.min(1, current / target),
    earned: current >= target,
  };
}

export function computeMeaningfulAchievements({
  stats,
  places,
  visits,
}: InsightInput) {
  const visitedCategories = new Set(visits.map((visit) => visit.poi_category)).size;
  const savedPlaces = places.filter((place) => place.is_saved).length;

  return [
    achievement(
      "first-footprint",
      "첫 발자국",
      "처음으로 한 장소의 기억을 남겼어요.",
      stats.total_visits,
      1,
    ),
    achievement(
      "three-perspectives",
      "세 가지 풍경",
      "서로 다른 세 종류의 장소를 경험해 보세요.",
      visitedCategories,
      3,
    ),
    achievement(
      "saved-constellation",
      "나의 장소 별자리",
      "다시 찾고 싶은 장소 다섯 곳을 모아보세요.",
      savedPlaces,
      5,
    ),
    achievement(
      "thoughtful-notes",
      "다섯 번의 회고",
      "방문 뒤 느낀 점을 다섯 번 기록해 보세요.",
      stats.total_reviews,
      5,
    ),
    achievement(
      "photo-trail",
      "빛으로 남긴 길",
      "다섯 장의 사진으로 장소의 순간을 남겨보세요.",
      stats.total_photos,
      5,
    ),
  ];
}

export type MonthlyRecap = {
  monthLabel: string;
  visitCount: number;
  uniquePlaceCount: number;
  reviewCount: number;
  uniquePhotoCount: number;
  topMood: string | null;
  mostVisitedPlace: string | null;
};

export function buildMonthlyRecap(
  visits: Visit[],
  reviews: Review[],
  now = new Date(),
): MonthlyRecap | null {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthlyVisits = visits.filter((visit) => {
    const date = new Date(visit.arrived_at);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month;
  });
  if (monthlyVisits.length === 0) return null;

  const monthlyVisitIds = new Set(monthlyVisits.map((visit) => visit.id));
  const monthlyReviews = reviews.filter((review) => monthlyVisitIds.has(review.visit_id));
  const photoIds = new Set([
    ...monthlyVisits.flatMap((visit) => visit.photo_ids),
    ...monthlyReviews.flatMap((review) => review.photo_ids),
  ]);

  const moods = new Map<string, { count: number; latest: string }>();
  const places = new Map<string, { count: number; latest: string; name: string }>();
  for (const visit of monthlyVisits) {
    if (visit.mood) {
      const current = moods.get(visit.mood);
      moods.set(visit.mood, {
        count: (current?.count ?? 0) + 1,
        latest:
          !current || visit.arrived_at > current.latest
            ? visit.arrived_at
            : current.latest,
      });
    }
    const currentPlace = places.get(visit.poi_id);
    places.set(visit.poi_id, {
      count: (currentPlace?.count ?? 0) + 1,
      latest:
        !currentPlace || visit.arrived_at > currentPlace.latest
          ? visit.arrived_at
          : currentPlace.latest,
      name: visit.poi_name,
    });
  }

  const topMood =
    Array.from(moods.entries()).sort(
      (a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest),
    )[0]?.[0] ?? null;
  const mostVisitedPlace =
    Array.from(places.values()).sort(
      (a, b) =>
        b.count - a.count ||
        b.latest.localeCompare(a.latest) ||
        a.name.localeCompare(b.name, "ko"),
    )[0]?.name ?? null;

  return {
    monthLabel: new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month, 1))),
    visitCount: monthlyVisits.length,
    uniquePlaceCount: new Set(monthlyVisits.map((visit) => visit.poi_id)).size,
    reviewCount: monthlyReviews.length,
    uniquePhotoCount: photoIds.size,
    topMood,
    mostVisitedPlace,
  };
}

export function getLevelProgress(totalXp: number) {
  const level = getLevelForXp(totalXp);
  const finalThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] ?? 0;
  const currentThreshold =
    level <= LEVEL_THRESHOLDS.length
      ? (LEVEL_THRESHOLDS[level - 1] ?? 0)
      : finalThreshold + (level - LEVEL_THRESHOLDS.length - 1) * 2_500;
  const nextThreshold =
    level < LEVEL_THRESHOLDS.length
      ? (LEVEL_THRESHOLDS[level] ?? currentThreshold + 2_500)
      : currentThreshold + 2_500;
  const span = Math.max(1, nextThreshold - currentThreshold);

  return {
    level,
    currentThreshold,
    nextThreshold,
    xpToNext: Math.max(0, nextThreshold - totalXp),
    progress: Math.min(1, Math.max(0, (totalXp - currentThreshold) / span)),
  };
}
