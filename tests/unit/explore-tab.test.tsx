import { fireEvent, render, screen, within } from "@testing-library/react";

import { ExploreTab } from "@/components/tabs/ExploreTab";
import type { PlaceSummary } from "@/types";

const places: PlaceSummary[] = [
  {
    id: "palace-1",
    name: "고요한 궁궐",
    description: "도심에서 만나는 오래된 돌담길",
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
    visit_count: 2,
    last_visited_at: "2026-07-18T09:00:00.000Z",
    tags: ["아이와", "산책"],
  },
  {
    id: "forest-1",
    name: "바람 숲길",
    description: "천천히 걷기 좋은 녹음길",
    category: "nature",
    latitude: 37.5,
    longitude: 127.0,
    geofence_radius_m: 80,
    region: "서울",
    district: "성동",
    source: "dummy",
    base_xp: 10,
    is_saved: false,
    is_visited: false,
    visit_count: 0,
    tags: ["혼자"],
  },
];

describe("ExploreTab", () => {
  it("combines saved and nature filters in the compact accessible filter region", () => {
    const savedNaturePlaces = Array.from({ length: 26 }, (_, index) => ({
      ...places[1],
      id: `saved-nature-${index + 1}`,
      name: `저장 자연 장소 ${index + 1}`,
      is_saved: true,
    }));
    const filterPlaces = [
      ...savedNaturePlaces,
      { ...places[0], id: "saved-cultural", name: "저장 문화 장소", is_saved: true },
      ...Array.from({ length: 23 }, (_, index) => ({
        ...places[1],
        id: `unsaved-nature-${index + 1}`,
        name: `미저장 자연 장소 ${index + 1}`,
        is_saved: false,
      })),
    ];

    render(
      <ExploreTab
        pois={filterPlaces}
        selectedPoiId={null}
        onSelectPoi={vi.fn()}
        onToggleSaved={vi.fn()}
        onUpdateTags={vi.fn()}
        onShowOnMap={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    const filterRegion = screen.getByRole("region", { name: "장소 필터" });
    const savedFilter = within(filterRegion).getByRole("button", { name: "저장한 장소" });
    const natureFilter = within(filterRegion).getByRole("button", { name: "자연" });

    expect(screen.getAllByRole("button", { name: /상세 보기/ })).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: "더 보기 24/50" }));
    expect(screen.getAllByRole("button", { name: /상세 보기/ })).toHaveLength(48);

    fireEvent.click(savedFilter);
    fireEvent.click(natureFilter);

    expect(savedFilter).toHaveAttribute("aria-pressed", "true");
    expect(natureFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /상세 보기/ })).toHaveLength(24);
    expect(screen.getByRole("button", { name: "더 보기 24/26" })).toBeInTheDocument();
    expect(screen.getByText("저장 자연 장소 1")).toBeInTheDocument();
    expect(screen.queryByText("저장 문화 장소")).not.toBeInTheDocument();
    expect(screen.queryByText("미저장 자연 장소 1")).not.toBeInTheDocument();
  });

  it("progressively reveals large local result sets", () => {
    const manyPlaces = Array.from({ length: 50 }, (_, index) => ({
      ...places[1],
      id: `forest-${index + 1}`,
      name: `바람 숲길 ${index + 1}`,
    }));

    render(
      <ExploreTab
        pois={manyPlaces}
        selectedPoiId={null}
        onSelectPoi={vi.fn()}
        onToggleSaved={vi.fn()}
        onUpdateTags={vi.fn()}
        onShowOnMap={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /상세 보기/ })).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: "더 보기 24/50" }));
    expect(screen.getAllByRole("button", { name: /상세 보기/ })).toHaveLength(48);
  });

  it("searches names and tags and filters saved places", () => {
    render(
      <ExploreTab
        pois={places}
        selectedPoiId={null}
        onSelectPoi={vi.fn()}
        onToggleSaved={vi.fn()}
        onUpdateTags={vi.fn()}
        onShowOnMap={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "장소 검색" }), {
      target: { value: "혼자" },
    });
    expect(screen.getByText("바람 숲길")).toBeInTheDocument();
    expect(screen.queryByText("고요한 궁궐")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "장소 검색" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장한 장소" }));
    expect(screen.getByText("고요한 궁궐")).toBeInTheDocument();
    expect(screen.queryByText("바람 숲길")).not.toBeInTheDocument();
  });

  it("opens place details and updates saved state and tags", async () => {
    const onToggleSaved = vi.fn().mockResolvedValue(undefined);
    const onUpdateTags = vi.fn().mockResolvedValue(undefined);
    render(
      <ExploreTab
        pois={places}
        selectedPoiId={null}
        onSelectPoi={vi.fn()}
        onToggleSaved={onToggleSaved}
        onUpdateTags={onUpdateTags}
        onShowOnMap={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /고요한 궁궐 상세 보기/ }));
    const dialog = screen.getByRole("dialog", { name: "고요한 궁궐" });
    expect(within(dialog).getByText("2번의 방문")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "아이와 태그 삭제" }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "저장 해제" }));
    expect(onToggleSaved).toHaveBeenCalledWith("palace-1", false);

    fireEvent.change(within(dialog).getByRole("textbox", { name: "새 태그" }), {
      target: { value: "노을" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "태그 추가" }));
    expect(onUpdateTags).toHaveBeenCalledWith("palace-1", ["아이와", "산책", "노을"]);
  });
});
