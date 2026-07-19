import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JournalTab } from "@/components/tabs/JournalTab";
import type { PasoJournalController } from "@/hooks/usePasoJournal";
import type { PlaceSummary, Review, Visit } from "@/types";

const mocks = vi.hoisted(() => ({
  takePhoto: vi.fn(),
  saveJournalPhoto: vi.fn(),
  deleteJournalPhoto: vi.fn(),
  getJournalPhotoUrl: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}));

vi.mock("@/lib/native/camera", () => ({ takePhoto: mocks.takePhoto }));
vi.mock("@/lib/media/photo-store", () => ({
  saveJournalPhoto: mocks.saveJournalPhoto,
  deleteJournalPhoto: mocks.deleteJournalPhoto,
  getJournalPhotoUrl: mocks.getJournalPhotoUrl,
}));
vi.mock("@/lib/geo/gps-tracker", () => ({
  requestPermissions: mocks.requestPermissions,
  getCurrentPosition: mocks.getCurrentPosition,
}));

const place: PlaceSummary = {
  id: "palace-1",
  name: "고요한 궁궐",
  description: "오래된 돌담길",
  category: "cultural_heritage",
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

function createVisit(id: string, arrivedAt: string): Visit {
  return {
    id,
    poi_id: place.id,
    poi_name: place.name,
    poi_category: place.category,
    arrived_at: arrivedAt,
    latitude: place.latitude,
    longitude: place.longitude,
    memo: "돌담을 천천히 걸었다.",
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
    created_at: arrivedAt,
  };
}

function createModel(): PasoJournalController {
  const recentVisits = [
    createVisit("recent", "2026-07-19T08:00:00.000Z"),
    createVisit("anniversary", "2025-07-19T08:00:00.000Z"),
  ];
  const recentReviews: Review[] = [
    {
      id: "review-recent",
      poi_id: place.id,
      poi_name: place.name,
      visit_id: "recent",
      rating: 5,
      text: "다시 걷고 싶은 조용한 길",
      tags: [],
      photo_ids: [],
      is_shared: false,
      created_at: "2026-07-19T09:00:00.000Z",
    },
  ];

  return {
    status: "ready",
    error: null,
    pois: [place],
    profile: { nickname: "Paso Walker", created_at: "2026-01-01", total_xp: 20, level: 1 },
    recentReviews,
    recentVisits,
    selectedPoi: place,
    selectedVisit: recentVisits[0],
    stats: {
      total_visits: 2,
      unique_pois_visited: 1,
      total_reviews: 1,
      total_photos: 0,
      total_distance_km: 0,
      total_xp: 20,
      level: 1,
      current_streak: 1,
      steps_today: 0,
      steps_weekly_avg: 0,
      updated_at: "2026-07-19",
    },
    database: null,
    canPersist: true,
    storageMode: "indexeddb",
    setSelectedPoiId: vi.fn(),
    recordVisit: vi.fn().mockResolvedValue(createVisit("new", "2026-07-19T10:00:00.000Z")),
    saveReview: vi.fn(),
    toggleSaved: vi.fn(),
    updatePoiTags: vi.fn(),
    refresh: vi.fn(),
  } as unknown as PasoJournalController;
}

describe("JournalTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPermissions.mockResolvedValue(true);
  });

  it("renders an anniversary memory and review within the dated timeline", () => {
    render(
      <JournalTab
        model={createModel()}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    expect(screen.getByText("이날의 기억")).toBeInTheDocument();
    expect(screen.getByText(/1년 전/)).toBeInTheDocument();
    expect(screen.getByText("다시 걷고 싶은 조용한 길")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 19일")).toBeInTheDocument();
  });

  it("commits staged photos only when recording the visit", async () => {
    const model = createModel();
    mocks.takePhoto.mockResolvedValue("data:image/jpeg;base64,cGFzbw==");
    mocks.saveJournalPhoto.mockResolvedValue({
      id: "photo-new.jpg",
      previewUrl: "data:image/jpeg;base64,cGFzbw==",
    });

    render(
      <JournalTab
        model={model}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "사진 추가" }));
    expect(await screen.findByAltText("방문 사진 미리보기 1")).toBeInTheDocument();
    expect(mocks.saveJournalPhoto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "방문 기록하기" }));

    await waitFor(() => {
      expect(mocks.saveJournalPhoto).toHaveBeenCalledTimes(1);
      expect(model.recordVisit).toHaveBeenCalledWith(
        expect.objectContaining({ photoIds: ["photo-new.jpg"] }),
      );
    });
  });

  it("marks a visit as GPS verified only after an in-range position check", async () => {
    const model = createModel();
    mocks.getCurrentPosition.mockResolvedValue({
      coords: {
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: place.latitude,
        longitude: place.longitude,
        speed: null,
      },
      timestamp: Date.now(),
    });

    render(
      <JournalTab
        model={model}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "현재 위치 확인" }));
    expect(await screen.findByText("현장에서 확인됨")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "방문 기록하기" }));

    await waitFor(() => {
      expect(model.recordVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationMode: "gps",
          latitude: place.latitude,
          longitude: place.longitude,
          gpsAccuracyM: 5,
        }),
      );
    });
  });
});
