"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

import { OfflineMapCanvas } from "@/components/map/OfflineMapCanvas";
import { getPOIMarkerColor, getPOIPopupLabel } from "@/components/map/POIMarker";
import { getMapboxAccessToken } from "@/lib/config/env";
import type { POI, Visit } from "@/types";

type MapViewProps = {
  pois: POI[];
  status: "loading" | "ready" | "error";
  error: Error | null;
  selectedPoi: POI | null;
  recentVisits: Visit[];
  onSelectPoi: (poiId: string) => void;
  fullscreen?: boolean;
};

export function MapView({
  pois,
  status,
  error,
  selectedPoi,
  onSelectPoi,
  fullscreen = false,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const token = getMapboxAccessToken();

  useEffect(() => {
    if (!token || !mapContainerRef.current || pois.length === 0) {
      return;
    }

    let map: MapboxMap | null = null;
    let mounted = true;

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = token;

      if (!mounted || !mapContainerRef.current) {
        return;
      }

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [126.978, 37.5665],
        zoom: 10.5,
        attributionControl: false,
      });

      const bounds = new mapboxgl.LngLatBounds();
      for (const poi of pois) {
        bounds.extend([poi.longitude, poi.latitude]);
        const markerElement = document.createElement("button");
        markerElement.type = "button";
        markerElement.ariaLabel = poi.name;
        markerElement.title = poi.name;
        markerElement.className = "h-5 w-5 rounded-full border-2 border-stone-950";
        markerElement.style.backgroundColor = getPOIMarkerColor(poi.category);
        markerElement.style.transform =
          poi.id === selectedPoi?.id ? "scale(1.25)" : "scale(1)";
        markerElement.addEventListener("click", () => onSelectPoi(poi.id));

        new mapboxgl.Marker({
          element: markerElement,
        })
          .setLngLat([poi.longitude, poi.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(getPOIPopupLabel(poi)))
          .addTo(map);
      }

      if (pois.length > 1) {
        map.fitBounds(bounds, {
          padding: 48,
          duration: 0,
          maxZoom: 12,
        });
      }
    })();

    return () => {
      mounted = false;
      map?.remove();
    };
  }, [onSelectPoi, pois, selectedPoi?.id, token]);

  if (status === "loading") {
    return (
      <section
        className={
          fullscreen
            ? "flex h-full items-center justify-center px-6"
            : "rounded-[1.75rem] border p-8"
        }
        style={{ backgroundColor: "var(--map-land)", borderColor: "var(--border)" }}
      >
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            로컬 지도를 준비하고 있어요
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
            번들 장소 데이터를 기기 저장소에서 불러오는 중입니다
          </p>
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section
        className={
          fullscreen
            ? "flex h-full items-center justify-center px-6"
            : "rounded-[1.75rem] border p-8"
        }
        style={{ backgroundColor: "var(--error-bg)", borderColor: "var(--error)" }}
      >
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-bold" style={{ color: "var(--error)" }}>
            로컬 지도를 열 수 없어요
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {error?.message ?? "기기 저장소를 초기화하지 못했습니다."}
          </p>
        </div>
      </section>
    );
  }

  if (!token) {
    return (
      <OfflineMapCanvas
        pois={pois}
        selectedPoi={selectedPoi}
        onSelectPoi={onSelectPoi}
        fullscreen={fullscreen}
      />
    );
  }

  return (
    <section
      className={
        fullscreen
          ? "h-full bg-stone-900/70"
          : "rounded-[1.75rem] border border-stone-800 bg-stone-900/70 p-4 sm:p-6"
      }
    >
      {!fullscreen ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
              실시간 지도
            </h2>
            <p className="mt-2 text-sm leading-7 text-stone-300">
              번들 장소 데이터가 지도에 표시됩니다.
            </p>
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-300/90">
            {pois.length} POIs
          </p>
        </div>
      ) : null}
      <div
        ref={mapContainerRef}
        className={
          fullscreen
            ? "h-full"
            : "h-[420px] rounded-[1.25rem] border border-stone-800"
        }
      />
      {selectedPoi && !fullscreen ? (
        <div className="mt-4 rounded-[1.25rem] border border-stone-800 bg-stone-950/50 px-4 py-4">
          <p className="text-sm uppercase tracking-[0.22em] text-amber-300/80">
            선택한 장소
          </p>
          <h3 className="mt-2 text-xl font-semibold text-stone-50">
            {selectedPoi.name}
          </h3>
          <p className="mt-2 text-sm leading-7 text-stone-300">
            {selectedPoi.region} / {selectedPoi.district}
          </p>
        </div>
      ) : null}
    </section>
  );
}
