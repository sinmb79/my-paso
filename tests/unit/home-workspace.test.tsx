import { render, screen } from "@testing-library/react";

import { HomeWorkspace } from "@/components/home/HomeWorkspace";
import { usePasoJournal, type PasoJournalController } from "@/hooks/usePasoJournal";

vi.mock("@/hooks/usePasoJournal", () => ({
  usePasoJournal: vi.fn(),
}));

function createJournalModel(): PasoJournalController {
  return {
    status: "ready",
    error: null,
    pois: [],
    profile: {
      nickname: "Paso Walker",
      created_at: "2026-07-19T00:00:00.000Z",
      total_xp: 0,
      level: 1,
    },
    recentReviews: [],
    recentVisits: [],
    selectedPoi: null,
    selectedVisit: null,
    stats: {
      total_visits: 0,
      unique_pois_visited: 0,
      total_reviews: 0,
      total_photos: 0,
      total_distance_km: 0,
      total_xp: 0,
      level: 1,
      current_streak: 0,
      steps_today: 0,
      steps_weekly_avg: 0,
      updated_at: "2026-07-19T00:00:00.000Z",
    },
    database: null,
    canPersist: false,
    storageMode: "memory",
    setSelectedPoiId: vi.fn(),
    recordVisit: vi.fn(),
    saveReview: vi.fn(),
    refresh: vi.fn(),
  } as PasoJournalController;
}

describe("HomeWorkspace storage safety", () => {
  it("keeps tab scrolling inside a fixed app viewport", () => {
    vi.mocked(usePasoJournal).mockReturnValue(createJournalModel());

    render(<HomeWorkspace />);

    expect(screen.getByTestId("app-viewport")).toHaveClass(
      "h-dvh",
      "overflow-hidden",
    );
  });

  it("warns when the journal is running in volatile memory", () => {
    vi.mocked(usePasoJournal).mockReturnValue(createJournalModel());

    render(<HomeWorkspace />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 기기에는 기록을 안전하게 저장할 수 없어요",
    );
  });
});
