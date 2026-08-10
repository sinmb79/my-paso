import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProfileTab } from "@/components/tabs/ProfileTab";
import type { PasoJournalController } from "@/hooks/usePasoJournal";

const mocks = vi.hoisted(() => ({
  inspectPasoSnapshot: vi.fn(),
  restorePasoSnapshot: vi.fn(),
  exportPasoSnapshot: vi.fn(),
  readBackupFile: vi.fn(),
  writeBackupFile: vi.fn(),
  shareBackupFile: vi.fn(),
}));

vi.mock("@/lib/export/json-export", () => ({
  inspectPasoSnapshot: mocks.inspectPasoSnapshot,
  restorePasoSnapshot: mocks.restorePasoSnapshot,
  exportPasoSnapshot: mocks.exportPasoSnapshot,
}));

vi.mock("@/lib/native/filesystem", () => ({
  readBackupFile: mocks.readBackupFile,
  writeBackupFile: mocks.writeBackupFile,
}));

vi.mock("@/lib/native/share", () => ({
  shareBackupFile: mocks.shareBackupFile,
}));

function createJournalModel(): PasoJournalController {
  return {
    status: "ready",
    error: null,
    pois: [],
    profile: {
      nickname: "Paso Walker",
      created_at: "2026-07-19T00:00:00.000Z",
      total_xp: 120,
      level: 2,
    },
    recentReviews: [],
    recentVisits: [],
    selectedPoi: null,
    selectedVisit: null,
    stats: {
      total_visits: 2,
      unique_pois_visited: 2,
      total_reviews: 1,
      total_photos: 0,
      total_distance_km: 0,
      total_xp: 120,
      level: 2,
      current_streak: 1,
      steps_today: 0,
      steps_weekly_avg: 0,
      updated_at: "2026-07-19T00:00:00.000Z",
    },
    database: { storageMode: "indexeddb" },
    canPersist: true,
    storageMode: "indexeddb",
    setSelectedPoiId: vi.fn(),
    recordVisit: vi.fn(),
    saveReview: vi.fn(),
    refresh: vi.fn(),
  } as unknown as PasoJournalController;
}

describe("ProfileTab backup restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the local-only archive status with a decorative dark texture", () => {
    const { container } = render(<ProfileTab model={createJournalModel()} onToast={vi.fn()} />);

    expect(screen.getByText("이 기기에 보관됨 · 계정 없음")).toBeInTheDocument();
    expect(
      screen.getByText("Hello! My Paso! v0.3.0 · Local-First"),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src*="paso-memory-trail-dark-v2.webp"][aria-hidden="true"]'),
    ).toBeInTheDocument();
  });

  it("shows a validated backup preview before restoring", async () => {
    const model = createJournalModel();
    const payload = { version: "2.0-local" };
    mocks.readBackupFile.mockResolvedValue(JSON.stringify(payload));
    mocks.inspectPasoSnapshot.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      version: "2.0-local",
      exportedAt: "2026-07-19T00:00:00.000Z",
      recordCounts: {
        pois: 100,
        visits: 2,
        reviews: 1,
        xp_log: 3,
        place_collections: 1,
        media: 2,
      },
    });

    const { container } = render(
      <ProfileTab model={model} onToast={vi.fn()} />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [new File(["backup"], "paso-backup.json", { type: "application/json" })],
      },
    });

    expect(await screen.findByText("백업 확인")).toBeInTheDocument();
    expect(screen.getByText("100개 장소")).toBeInTheDocument();
    expect(screen.getByText("2회 방문")).toBeInTheDocument();
    expect(mocks.restorePasoSnapshot).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "이 백업으로 복원" }));

    await waitFor(() => {
      expect(mocks.restorePasoSnapshot).toHaveBeenCalledWith(
        model.database,
        payload,
      );
    });
  });

  it("shows level progress, a monthly recap, and honest achievement progress", () => {
    const model = createJournalModel();
    const place = {
      id: "palace-1",
      name: "고요한 궁궐",
      category: "cultural_heritage" as const,
      latitude: 37.57,
      longitude: 126.98,
      geofence_radius_m: 50,
      region: "서울",
      district: "종로",
      source: "dummy",
      base_xp: 10,
      is_saved: true,
      is_visited: true,
      visit_count: 1,
      tags: [],
    };
    model.pois = [place];
    model.stats.total_reviews = 2;
    model.recentVisits = [
      {
        id: "visit-1",
        poi_id: place.id,
        poi_name: place.name,
        poi_category: place.category,
        arrived_at: "2026-07-19T08:00:00.000Z",
        latitude: place.latitude,
        longitude: place.longitude,
        mood: "calm",
        photo_ids: [],
        xp_earned: 20,
        xp_breakdown: {
          base_visit: 10,
          first_visit_bonus: 10,
          review_bonus: 0,
          photo_bonus: 0,
          streak_bonus: 0,
        },
        created_at: "2026-07-19T08:00:00.000Z",
      },
    ];

    render(
      <ProfileTab
        model={model}
        onToast={vi.fn()}
        now={new Date("2026-07-20T00:00:00.000Z")}
      />,
    );

    expect(screen.getByText("다음 레벨까지 130 XP")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월의 기억")).toBeInTheDocument();
    expect(screen.getByText("가장 자주 찾은 곳")).toBeInTheDocument();
    expect(screen.getByText("첫 발자국")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("mounts local AI settings under the Profile owner controls", () => {
    render(<ProfileTab model={createJournalModel()} onToast={vi.fn()} />);

    const ownerControls = screen.getByText("Owner controls");
    const localAiHeading = screen.getByRole("heading", { name: "로컬 AI" });
    expect(ownerControls).toBeInTheDocument();
    expect(ownerControls.compareDocumentPosition(localAiHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "로컬 AI 사용" })).toBeInTheDocument();
  });
});
