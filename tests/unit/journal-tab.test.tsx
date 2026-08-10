import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { JournalTab } from "@/components/tabs/JournalTab";
import type { PasoJournalController } from "@/hooks/usePasoJournal";
import { saveLocalAISettings } from "@/lib/ai/preferences";
import type { PlaceSummary, Review, Visit } from "@/types";

const mocks = vi.hoisted(() => ({
  takePhoto: vi.fn(),
  saveJournalPhoto: vi.fn(),
  deleteJournalPhoto: vi.fn(),
  getJournalPhotoUrl: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
  sanitizePhotoForLocalAI: vi.fn(),
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
vi.mock("@/lib/ai/photo-sanitizer", () => ({
  sanitizePhotoForLocalAI: mocks.sanitizePhotoForLocalAI,
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

async function enableTextAI() {
  await saveLocalAISettings({
    enabled: true,
    vendor: "naver",
    endpoint: "http://127.0.0.1:8000",
    model: "local-korean-model",
    capability: "text",
    confirmedPrivateLANEndpoint: null,
  });
}

function stubKeywordDraft(keywords: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "태그 경계 기록",
                  body: "키워드 저장 범위를 확인한다.",
                  category: null,
                  keywords,
                  mood: null,
                  altText: "",
                  observations: [],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

async function applyKeywordDraftAndRecord() {
  fireEvent.click(await screen.findByRole("button", { name: "AI로 빠르게 작성" }));
  fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
  expect(await screen.findByDisplayValue("태그 경계 기록")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "초안 적용" }));
  fireEvent.click(screen.getByRole("button", { name: "방문 기록하기" }));
}

describe("JournalTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.unstubAllGlobals();
    mocks.requestPermissions.mockResolvedValue(true);
    mocks.sanitizePhotoForLocalAI.mockResolvedValue(
      "data:image/jpeg;base64,c2FuaXRpemVk",
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("shows AI drafting only after enabled settings load and still validate", async () => {
    const { unmount } = render(
      <JournalTab
        model={createModel()}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "AI로 빠르게 작성" })).not.toBeInTheDocument();
    });
    unmount();

    await saveLocalAISettings({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "vision",
      confirmedPrivateLANEndpoint: null,
    });
    render(
      <JournalTab
        model={createModel()}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    expect(await screen.findByRole("button", { name: "AI로 빠르게 작성" })).toBeInTheDocument();
  });

  it("applies an editable draft without saving and persists keywords only after normal visit save", async () => {
    await saveLocalAISettings({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "vision",
      confirmedPrivateLANEndpoint: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "돌담의 오후",
                    body: "고요한 길을 천천히 걸었다.",
                    category: "historic_site",
                    keywords: ["돌담", "산책"],
                    mood: "평온",
                    altText: "오래된 돌담 옆 산책길",
                    observations: ["회색 돌담이 보임"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const model = createModel();
    model.selectedPoi = { ...place, tags: ["기존"] };
    model.pois = [model.selectedPoi];
    mocks.takePhoto.mockResolvedValue("data:image/jpeg;base64,b3JpZ2luYWw=");
    mocks.saveJournalPhoto.mockResolvedValue({
      id: "photo-new.jpg",
      previewUrl: "data:image/jpeg;base64,b3JpZ2luYWw=",
    });

    render(
      <JournalTab
        model={model}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    fireEvent.change(screen.getByLabelText("방문 메모"), {
      target: { value: "내가 먼저 적은 메모" },
    });
    fireEvent.click(screen.getByRole("button", { name: "사진 추가" }));
    expect(await screen.findByAltText("방문 사진 미리보기 1")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "AI로 빠르게 작성" }));

    expect(
      within(screen.getByRole("dialog")).getByText("내가 먼저 적은 메모"),
    ).toBeInTheDocument();
    expect(model.recordVisit).not.toHaveBeenCalled();
    expect(model.saveReview).not.toHaveBeenCalled();
    expect(mocks.saveJournalPhoto).not.toHaveBeenCalled();
    expect(model.updatePoiTags).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    expect(await screen.findByDisplayValue("돌담의 오후")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초안 적용" }));

    expect(screen.getByLabelText("방문 메모")).toHaveValue(
      "돌담의 오후\n\n고요한 길을 천천히 걸었다.",
    );
    expect(screen.getByText("제안 분류: 역사 장소")).toBeInTheDocument();
    expect(screen.getByText("사진 설명 제안: 오래된 돌담 옆 산책길")).toBeInTheDocument();
    expect(screen.getByText("저장 대기 키워드: 돌담 · 산책")).toBeInTheDocument();
    expect(model.recordVisit).not.toHaveBeenCalled();
    expect(model.saveReview).not.toHaveBeenCalled();
    expect(mocks.saveJournalPhoto).not.toHaveBeenCalled();
    expect(model.updatePoiTags).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "방문 기록하기" }));

    await waitFor(() => {
      expect(model.recordVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          memo: "돌담의 오후\n\n고요한 길을 천천히 걸었다.",
          mood: "calm",
          photoIds: ["photo-new.jpg"],
        }),
      );
      expect(model.updatePoiTags).toHaveBeenCalledWith(place.id, ["기존", "돌담", "산책"]);
    });
  });

  it("keeps the applied draft and pending keywords when normal visit saving fails", async () => {
    await saveLocalAISettings({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "text",
      confirmedPrivateLANEndpoint: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "남겨 둘 제목",
                    body: "다시 저장할 본문",
                    category: null,
                    keywords: ["재시도"],
                    mood: "알 수 없음",
                    altText: "",
                    observations: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const model = createModel();
    vi.mocked(model.recordVisit).mockRejectedValue(new Error("저장 실패"));

    render(
      <JournalTab
        model={model}
        onToast={vi.fn()}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "AI로 빠르게 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    expect(await screen.findByDisplayValue("남겨 둘 제목")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초안 적용" }));
    fireEvent.click(screen.getByRole("button", { name: "방문 기록하기" }));

    await waitFor(() => expect(model.recordVisit).toHaveBeenCalledTimes(1));
    expect(model.updatePoiTags).not.toHaveBeenCalled();
    expect(screen.getByLabelText("방문 메모")).toHaveValue("남겨 둘 제목\n\n다시 저장할 본문");
    expect(screen.getByText("저장 대기 키워드: 재시도")).toBeInTheDocument();
  });

  it("retries only failed AI keywords after a visit and photo persist exactly once", async () => {
    await saveLocalAISettings({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "vision",
      confirmedPrivateLANEndpoint: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "사진이 있는 기록",
                    body: "방문은 정상 저장된다.",
                    category: null,
                    keywords: ["태그재시도"],
                    mood: null,
                    altText: "",
                    observations: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const model = createModel();
    vi.mocked(model.updatePoiTags)
      .mockRejectedValueOnce(new Error("태그 저장 실패"))
      .mockResolvedValueOnce(undefined);
    const onToast = vi.fn();
    mocks.takePhoto.mockResolvedValue("data:image/jpeg;base64,b3JpZ2luYWw=");
    mocks.saveJournalPhoto.mockResolvedValue({
      id: "persisted-photo.jpg",
      previewUrl: "data:image/jpeg;base64,b3JpZ2luYWw=",
    });

    render(
      <JournalTab
        model={model}
        onToast={onToast}
        now={new Date("2026-07-19T12:00:00.000Z")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "사진 추가" }));
    expect(await screen.findByAltText("방문 사진 미리보기 1")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "AI로 빠르게 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    expect(await screen.findByDisplayValue("사진이 있는 기록")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초안 적용" }));
    fireEvent.click(screen.getByRole("button", { name: "방문 기록하기" }));

    await waitFor(() => expect(model.updatePoiTags).toHaveBeenCalledTimes(1));
    expect(model.recordVisit).toHaveBeenCalledTimes(1);
    expect(mocks.saveJournalPhoto).toHaveBeenCalledTimes(1);
    expect(mocks.deleteJournalPhoto).not.toHaveBeenCalled();
    expect(screen.getByLabelText("방문 메모")).toHaveValue("");
    expect(screen.queryByAltText("방문 사진 미리보기 1")).not.toBeInTheDocument();
    expect(screen.getByText("저장 대기 키워드: 태그재시도")).toBeInTheDocument();
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/방문을 기록했어요/), "success");
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/키워드/), "error");

    fireEvent.click(screen.getByRole("button", { name: "AI 키워드 다시 저장" }));

    await waitFor(() => expect(model.updatePoiTags).toHaveBeenCalledTimes(2));
    expect(model.recordVisit).toHaveBeenCalledTimes(1);
    expect(mocks.saveJournalPhoto).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "AI 키워드 다시 저장" })).not.toBeInTheDocument();
  });

  it("keeps eight existing tags, skips tag persistence, and shows the omitted AI keyword", async () => {
    await enableTextAI();
    stubKeywordDraft(["새 키워드"]);
    const model = createModel();
    model.selectedPoi = {
      ...place,
      tags: ["하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟"],
    };

    render(<JournalTab model={model} onToast={vi.fn()} />);
    await applyKeywordDraftAndRecord();

    await waitFor(() => expect(model.recordVisit).toHaveBeenCalledTimes(1));
    expect(model.updatePoiTags).not.toHaveBeenCalled();
    expect(screen.getByText("저장되지 않은 키워드: 새 키워드")).toBeInTheDocument();
  });

  it("fills only the last available tag slot and visibly omits the overflow keyword", async () => {
    await enableTextAI();
    stubKeywordDraft(["여덟째", "아홉째"]);
    const model = createModel();
    model.selectedPoi = {
      ...place,
      tags: ["하나", "둘", "셋", "넷", "다섯", "여섯", "일곱"],
    };

    render(<JournalTab model={model} onToast={vi.fn()} />);
    await applyKeywordDraftAndRecord();

    await waitFor(() =>
      expect(model.updatePoiTags).toHaveBeenCalledWith(place.id, [
        "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟째",
      ]),
    );
    expect(screen.getByText("저장되지 않은 키워드: 아홉째")).toBeInTheDocument();
  });

  it("treats whitespace and case variants as existing tags without a redundant update", async () => {
    await enableTextAI();
    stubKeywordDraft(["  seoul   cafe  ", "SEOUL CAFE"]);
    const model = createModel();
    model.selectedPoi = { ...place, tags: ["Seoul Cafe"] };

    render(<JournalTab model={model} onToast={vi.fn()} />);
    await applyKeywordDraftAndRecord();

    await waitFor(() => expect(model.recordVisit).toHaveBeenCalledTimes(1));
    expect(model.updatePoiTags).not.toHaveBeenCalled();
    expect(screen.queryByText(/저장되지 않은 키워드:/)).not.toBeInTheDocument();
  });

  it("persists an exact eight-tag result without reporting omissions", async () => {
    await enableTextAI();
    stubKeywordDraft(["일곱", "여덟"]);
    const model = createModel();
    model.selectedPoi = {
      ...place,
      tags: ["하나", "둘", "셋", "넷", "다섯", "여섯"],
    };

    render(<JournalTab model={model} onToast={vi.fn()} />);
    await applyKeywordDraftAndRecord();

    await waitFor(() =>
      expect(model.updatePoiTags).toHaveBeenCalledWith(place.id, [
        "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟",
      ]),
    );
    expect(screen.queryByText(/저장되지 않은 키워드:/)).not.toBeInTheDocument();
  });

  it("renders AI persistence guidance at the 12px informational minimum", async () => {
    await enableTextAI();
    stubKeywordDraft(["열두픽셀"]);
    render(<JournalTab model={createModel()} onToast={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "AI로 빠르게 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    expect(await screen.findByDisplayValue("태그 경계 기록")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초안 적용" }));

    expect(screen.getByText(/분류와 사진 설명은 참고용/)).toHaveClass("text-xs");
  });
});
