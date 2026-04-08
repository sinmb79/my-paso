import { getLevelForXp } from "@/lib/xp/level-table";

import type { XPBreakdown } from "@/types";

export function calculateVisitXP(baseXp: number, isFirstVisit: boolean) {
  const breakdown: XPBreakdown = {
    base_visit: baseXp,
    first_visit_bonus: isFirstVisit ? 10 : 0,
    review_bonus: 0,
    photo_bonus: 0,
    streak_bonus: 0,
  };

  return {
    totalXp:
      breakdown.base_visit +
      breakdown.first_visit_bonus +
      breakdown.review_bonus +
      breakdown.photo_bonus +
      breakdown.streak_bonus,
    breakdown,
  };
}

export function calculateReviewXP() {
  return 10;
}

export function deriveLevel(totalXp: number) {
  return getLevelForXp(totalXp);
}
