import { fireEvent, render, screen, within } from "@testing-library/react";

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

const densePois = Array.from({ length: 6 }, (_, index) => ({
  ...testPoi,
  id: `dense-poi-${index + 1}`,
  name: `밀집 장소 ${index + 1}`,
}));

function renderDenseCluster(onSelectPoi = vi.fn()) {
  render(
    <MapTab
      pois={densePois}
      status="ready"
      error={null}
      selectedPoi={null}
      recentVisits={[]}
      onSelectPoi={onSelectPoi}
      onNavigateToJournal={() => undefined}
    />,
  );

  return {
    cluster: screen.getByRole("button", {
      name: "밀집 장소 1 외 5곳, 6개 장소 선택",
    }),
    onSelectPoi,
  };
}

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

    expect(screen.getAllByRole("button", { name: /선택$/ }).length).toBeLessThanOrEqual(24);
  });

  it("declutters dense POIs into an accessible cluster that can select every member", () => {
    const onSelectPoi = vi.fn();
    const { cluster } = renderDenseCluster(onSelectPoi);
    expect(screen.getAllByRole("button", { name: /선택$/ })).toHaveLength(1);
    expect(cluster).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(cluster, { key: "Enter" });

    expect(cluster).toHaveAttribute("aria-expanded", "true");
    const chooser = screen.getByRole("dialog", { name: "장소 선택" });
    expect(chooser).toBeInTheDocument();
    for (const poi of densePois) {
      expect(
        screen.getByRole("button", { name: `${poi.name} 선택` }),
      ).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "밀집 장소 6 선택" }));
    expect(onSelectPoi).toHaveBeenCalledWith("dense-poi-6");
  });

  it("focuses the chooser and wraps Tab and Shift+Tab between its controls", () => {
    const { cluster } = renderDenseCluster();

    fireEvent.click(cluster);

    const chooser = screen.getByRole("dialog", { name: "장소 선택" });
    const closeButton = within(chooser).getByRole("button", { name: "장소 선택 닫기" });
    const lastMember = within(chooser).getByRole("button", { name: "밀집 장소 6 선택" });
    expect(closeButton).toHaveFocus();

    lastMember.focus();
    fireEvent.keyDown(lastMember, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(lastMember).toHaveFocus();
  });

  it("restores the cluster trigger after Escape, close, and backdrop dismissal", () => {
    const { cluster, onSelectPoi } = renderDenseCluster();

    fireEvent.click(cluster);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "장소 선택" }), { key: "Escape" });
    expect(cluster).toHaveFocus();
    expect(cluster).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(cluster);
    fireEvent.click(screen.getByRole("button", { name: "장소 선택 닫기" }));
    expect(cluster).toHaveFocus();
    expect(cluster).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(cluster);
    fireEvent.click(screen.getByTestId("cluster-chooser-backdrop"));
    expect(cluster).toHaveFocus();
    expect(cluster).toHaveAttribute("aria-expanded", "false");
    expect(onSelectPoi).not.toHaveBeenCalled();
  });

  it("opens a cluster with Space and restores focus after selecting exactly one member", () => {
    const { cluster, onSelectPoi } = renderDenseCluster();
    cluster.focus();

    fireEvent.keyDown(cluster, { key: " " });

    expect(cluster).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "장소 선택 닫기" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "밀집 장소 3 선택" }));

    expect(onSelectPoi).toHaveBeenCalledTimes(1);
    expect(onSelectPoi).toHaveBeenCalledWith("dense-poi-3");
    expect(cluster).toHaveFocus();
    expect(cluster).toHaveAttribute("aria-expanded", "false");
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
