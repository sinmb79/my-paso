import type { Review, Visit } from "@/types";

export type JournalTimelineEntry = {
  visit: Visit;
  review: Review | null;
};

export type JournalTimelineDay = {
  dateKey: string;
  entries: JournalTimelineEntry[];
};

export function buildJournalTimeline(
  visits: Visit[],
  reviews: Review[],
): JournalTimelineDay[] {
  const reviewByVisit = new Map(reviews.map((review) => [review.visit_id, review]));
  const groups = new Map<string, JournalTimelineEntry[]>();

  for (const visit of [...visits].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))) {
    const dateKey = visit.arrived_at.slice(0, 10);
    const entries = groups.get(dateKey) ?? [];
    entries.push({ visit, review: reviewByVisit.get(visit.id) ?? null });
    groups.set(dateKey, entries);
  }

  return Array.from(groups, ([dateKey, entries]) => ({ dateKey, entries })).sort(
    (a, b) => b.dateKey.localeCompare(a.dateKey),
  );
}

export function findOnThisDayMemory(visits: Visit[], now = new Date()) {
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();

  return (
    [...visits]
      .filter((visit) => {
        const date = new Date(visit.arrived_at);
        return (
          date.getUTCFullYear() < year &&
          date.getUTCMonth() === month &&
          date.getUTCDate() === day
        );
      })
      .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0] ?? null
  );
}
