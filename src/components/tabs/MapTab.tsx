"use client";

import { MapView } from "@/components/map/MapView";
import { getPOIMarkerColor } from "@/components/map/POIMarker";
import type { POI, PlaceSummary, Visit } from "@/types";

type MapPlace = POI & Partial<Pick<PlaceSummary, "is_saved" | "is_visited" | "visit_count" | "tags">>;

type MapTabProps = {
  pois: MapPlace[];
  status: "loading" | "ready" | "error";
  error: Error | null;
  selectedPoi: MapPlace | null;
  recentVisits: Visit[];
  onSelectPoi: (poiId: string) => void;
  onNavigateToJournal: () => void;
  onToggleSaved?: (poiId: string, saved: boolean) => Promise<void>;
  canPersist?: boolean;
};

export function MapTab({
  pois,
  status,
  error,
  selectedPoi,
  recentVisits,
  onSelectPoi,
  onNavigateToJournal,
  onToggleSaved,
  canPersist = true,
}: MapTabProps) {
  return (
    <div className="relative" style={{ height: "calc(100dvh - var(--tab-height))" }}>
      <div className="h-full">
        <MapView
          pois={pois}
          status={status}
          error={error}
          selectedPoi={selectedPoi}
          recentVisits={recentVisits}
          onSelectPoi={onSelectPoi}
          fullscreen
        />
      </div>

      {selectedPoi && status === "ready" ? (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t p-4 shadow-lg"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "color-mix(in srgb, var(--bg-card) 97%, transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: getPOIMarkerColor(selectedPoi.category) }}
            />
            <div className="min-w-0 flex-1">
              <h3
                className="truncate text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {selectedPoi.name}
              </h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {selectedPoi.region} / {selectedPoi.district}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}
            >
              {selectedPoi.base_xp} XP
            </span>
          </div>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            {onToggleSaved ? (
              <button
                type="button"
                aria-label={selectedPoi.is_saved ? "저장 해제" : "장소 저장"}
                onClick={() => void onToggleSaved(selectedPoi.id, !selectedPoi.is_saved)}
                disabled={!canPersist}
                className="flex h-11 w-12 items-center justify-center rounded-xl border disabled:opacity-40"
                style={{ borderColor: selectedPoi.is_saved ? "var(--accent)" : "var(--border)", color: selectedPoi.is_saved ? "var(--accent)" : "var(--text-secondary)" }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill={selectedPoi.is_saved ? "currentColor" : "none"}>
                  <path d="M6.75 3.75h10.5v16.5L12 16.8l-5.25 3.45V3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNavigateToJournal}
              className="rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98]"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              방문 기록하기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
