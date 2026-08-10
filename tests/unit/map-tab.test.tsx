import { fireEvent, render, screen } from "@testing-library/react";

import { MapTab } from "@/components/tabs/MapTab";
import type { POI } from "@/types";

const testPoi: POI = {
  id: "dummy-poi-1",
  name: "테스트 문화유산 01",
  description: "로컬 지도 테스트 장소",
  category: "cultural_heritage",
  latitude: 37.45,
  longitude: 126.82,
  geofence_radius_m: 50,
  region: "서울",
  district: "종로",
  source: "dummy",
  base_xp: 10,
};

describe("MapTab", () => {
  it("caps the first map render to a lightweight marker set", () => {
    const pois = Array.from({ length: 100 }, (_, index) => ({
      ...testPoi,
      id: `dummy-poi-${index + 1}`,
      name: `테스트 장소 ${index + 1}`,
      latitude: testPoi.latitude + index * 0.001,
      longitude: testPoi.longitude + index * 0.001,
    }));

    render(
      <MapTab
        pois={pois}
        status="ready"
        error={null}
        selectedPoi={null}
        recentVisits={[]}
        onSelectPoi={() => undefined}
        onNavigateToJournal={() => undefined}
      />,
    );

    expect(screen.getAllByRole("button", { name: /선택$/ })).toHaveLength(34);
  });

  it("uses an explicit fullscreen host without arbitrary descendant selectors", () => {
    const { container } = render(
      <MapTab
        pois={[]}
        status="ready"
        error={null}
        selectedPoi={null}
        recentVisits={[]}
        onSelectPoi={() => undefined}
        onNavigateToJournal={() => undefined}
      />,
    );

    const mapHost = container.firstElementChild?.firstElementChild;
    expect(mapHost).toHaveClass("h-full");
    expect(mapHost?.className).not.toContain("[&_");
  });

  it("renders an interactive offline map instead of developer setup instructions", () => {
    const onSelectPoi = vi.fn();
    render(
      <MapTab
        pois={[testPoi]}
        status="ready"
        error={null}
        selectedPoi={testPoi}
        recentVisits={[]}
        onSelectPoi={onSelectPoi}
        onNavigateToJournal={() => undefined}
      />,
    );

    expect(screen.getByText("장소 분포도 · 길찾기용 아님")).toBeInTheDocument();
    expect(screen.getByText("등록한 장소의 상대적 위치를 보여줘요")).toBeInTheDocument();
    expect(screen.queryByText("Map preview unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("마커를 눌러 장소를 선택하세요")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /테스트 문화유산 01/ }));
    expect(onSelectPoi).toHaveBeenCalledWith("dummy-poi-1");
  });
});
