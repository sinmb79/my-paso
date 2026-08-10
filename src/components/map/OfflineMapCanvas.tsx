"use client";

import { useState } from "react";

import { getPOICategoryLabel, getPOIMarkerColor } from "@/components/map/POIMarker";
import type { POI } from "@/types";

type OfflineMapCanvasProps = {
  pois: POI[];
  selectedPoi: POI | null;
  onSelectPoi: (poiId: string) => void;
  fullscreen: boolean;
};

type MarkerBounds = {
  minLatitude: number;
  minLongitude: number;
  latitudeSpan: number;
  longitudeSpan: number;
};

type MarkerCluster = {
  id: string;
  pois: POI[];
  position: { left: number; top: number };
  column: number;
  row: number;
};

const markerGridColumns = 6;
const markerGridRows = 4;

function getMarkerBounds(pois: POI[]): MarkerBounds {
  if (pois.length === 0) {
    return { minLatitude: 0, minLongitude: 0, latitudeSpan: 1, longitudeSpan: 1 };
  }

  let minLatitude = pois[0].latitude;
  let maxLatitude = pois[0].latitude;
  let minLongitude = pois[0].longitude;
  let maxLongitude = pois[0].longitude;

  for (const poi of pois) {
    minLatitude = Math.min(minLatitude, poi.latitude);
    maxLatitude = Math.max(maxLatitude, poi.latitude);
    minLongitude = Math.min(minLongitude, poi.longitude);
    maxLongitude = Math.max(maxLongitude, poi.longitude);
  }

  return {
    minLatitude,
    minLongitude,
    latitudeSpan: Math.max(maxLatitude - minLatitude, 0.0001),
    longitudeSpan: Math.max(maxLongitude - minLongitude, 0.0001),
  };
}

function getMarkerPosition(poi: POI, bounds: MarkerBounds) {
  const { minLatitude, minLongitude, latitudeSpan, longitudeSpan } = bounds;

  return {
    left: 7 + ((poi.longitude - minLongitude) / longitudeSpan) * 86,
    top: 8 + (1 - (poi.latitude - minLatitude) / latitudeSpan) * 84,
  };
}

function getMarkerClusters(pois: POI[], bounds: MarkerBounds): MarkerCluster[] {
  const clusters = new Map<string, MarkerCluster>();

  for (const poi of pois) {
    const position = getMarkerPosition(poi, bounds);
    const column = Math.min(
      markerGridColumns - 1,
      Math.max(0, Math.floor(((position.left - 7) / 86) * markerGridColumns)),
    );
    const row = Math.min(
      markerGridRows - 1,
      Math.max(0, Math.floor(((position.top - 8) / 84) * markerGridRows)),
    );
    const id = `${row}-${column}`;
    const existing = clusters.get(id);

    if (existing) {
      existing.pois.push(poi);
      continue;
    }

    clusters.set(id, {
      id,
      pois: [poi],
      position: {
        left: 7 + (column / (markerGridColumns - 1)) * 86,
        top: 8 + (row / (markerGridRows - 1)) * 84,
      },
      column,
      row,
    });
  }

  return Array.from(clusters.values()).sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
}

function getClusterLabel(cluster: MarkerCluster) {
  if (cluster.pois.length === 1) {
    return `${cluster.pois[0].name} 선택`;
  }

  return `${cluster.pois[0].name} 외 ${cluster.pois.length - 1}곳, ${cluster.pois.length}개 장소 선택`;
}

export function OfflineMapCanvas({
  pois,
  selectedPoi,
  onSelectPoi,
  fullscreen,
}: OfflineMapCanvasProps) {
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const markerBounds = getMarkerBounds(pois);
  const markerClusters = getMarkerClusters(pois, markerBounds);
  const openCluster = markerClusters.find((cluster) => cluster.id === openClusterId) ?? null;

  return (
    <section
      className={
        fullscreen
          ? "relative h-full overflow-hidden"
          : "relative h-[420px] overflow-hidden rounded-[var(--surface-radius)] border"
      }
      style={{
        backgroundColor: "var(--map-land)",
        borderColor: "var(--border)",
        boxShadow: fullscreen ? undefined : "var(--surface-shadow)",
      }}
      aria-label="오프라인 POI 지도"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="offline-map-grid" width="9" height="9" patternUnits="userSpaceOnUse">
            <path d="M 9 0 L 0 0 0 9" fill="none" stroke="var(--map-grid)" strokeWidth="0.35" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#offline-map-grid)" />
        <path
          d="M-8 80 C12 70 20 73 35 64 C49 55 56 63 69 53 C82 43 91 45 108 31 L108 108 L-8 108 Z"
          fill="var(--map-water)"
          opacity="0.72"
        />
        <g fill="none" strokeLinecap="round">
          <path d="M-8 31 C18 20 32 43 55 29 S86 17 108 28" stroke="var(--map-road-edge)" strokeWidth="5" />
          <path d="M-8 31 C18 20 32 43 55 29 S86 17 108 28" stroke="var(--map-road)" strokeWidth="3.3" />
          <path d="M19 -8 C29 19 18 38 32 57 S55 78 48 108" stroke="var(--map-road-edge)" strokeWidth="4" />
          <path d="M19 -8 C29 19 18 38 32 57 S55 78 48 108" stroke="var(--map-road)" strokeWidth="2.5" />
          <path d="M69 -8 C59 17 77 35 65 54 S72 84 88 108" stroke="var(--map-road-edge)" strokeWidth="3.3" />
          <path d="M69 -8 C59 17 77 35 65 54 S72 84 88 108" stroke="var(--map-road)" strokeWidth="2" />
          <path d="M3 62 C22 50 43 70 61 62 S87 61 101 51" stroke="var(--map-road)" strokeWidth="1.35" strokeDasharray="2.5 2" />
        </g>
        <g fill="var(--map-label)" fontSize="2.6" fontWeight="700" letterSpacing="0.45" opacity="0.52">
          <text x="8" y="48">로컬 데이터 구역</text>
          <text x="66" y="43">POI GRID</text>
          <text x="57" y="88">OFFLINE</text>
        </g>
      </svg>

      <div
        className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm"
        style={{
          borderColor: "color-mix(in srgb, var(--border) 72%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--bg-card) 88%, transparent)",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--success)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              장소 분포도 · 길찾기용 아님
            </h2>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
            등록한 장소의 상대적 위치를 보여줘요
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black tabular-nums" style={{ color: "var(--accent)" }}>
            {pois.length}
          </p>
          <p className="text-[10px] font-semibold tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            등록 장소
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-32 top-20">
        {markerClusters.map((cluster) => {
          const isCluster = cluster.pois.length > 1;
          const selected = cluster.pois.some((poi) => poi.id === selectedPoi?.id);
          const markerPoi = selected
            ? cluster.pois.find((poi) => poi.id === selectedPoi?.id) ?? cluster.pois[0]
            : cluster.pois[0];
          const color = getPOIMarkerColor(markerPoi.category);
          const clusterIsOpen = openClusterId === cluster.id;

          return (
            <button
              key={cluster.id}
              type="button"
              aria-label={getClusterLabel(cluster)}
              aria-controls={isCluster ? `cluster-chooser-${cluster.id}` : undefined}
              aria-expanded={isCluster ? clusterIsOpen : undefined}
              title={
                isCluster
                  ? `${cluster.pois.length}개 장소`
                  : `${markerPoi.name} · ${getPOICategoryLabel(markerPoi.category)}`
              }
              onClick={() => {
                if (isCluster) {
                  setOpenClusterId(cluster.id);
                  return;
                }

                onSelectPoi(markerPoi.id);
              }}
              onKeyDown={(event) => {
                if (!isCluster || (event.key !== "Enter" && event.key !== " ")) {
                  return;
                }

                event.preventDefault();
                setOpenClusterId(cluster.id);
              }}
              className="absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition active:scale-90"
              style={{
                left: `${cluster.position.left}%`,
                top: `${cluster.position.top}%`,
                zIndex: selected ? 10 : 1,
              }}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full border-2 ${selected ? "ring-4 shadow-lg" : ""}`}
                style={{
                  borderColor: selected ? color : "var(--map-marker-ring)",
                  backgroundColor: color,
                  boxShadow: selected ? `0 8px 24px color-mix(in srgb, ${color} 38%, transparent)` : undefined,
                }}
              />
              {isCluster ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black"
                  style={{ backgroundColor: "var(--paso-amber)", color: "var(--accent-contrast)" }}
                >
                  {cluster.pois.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {openCluster ? (
        <div
          id={`cluster-chooser-${openCluster.id}`}
          role="dialog"
          aria-modal="true"
          aria-label="장소 선택"
          className="absolute bottom-4 left-4 right-4 z-30 max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl border p-3 shadow-xl"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {openCluster.pois.length}개 장소 중 선택
              </h3>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                각 장소를 눌러 방문 기록으로 이어가세요
              </p>
            </div>
            <button
              type="button"
              aria-label="장소 선택 닫기"
              onClick={() => setOpenClusterId(null)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              ×
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {openCluster.pois.map((poi) => (
              <li key={poi.id}>
                <button
                  type="button"
                  aria-label={`${poi.name} 선택`}
                  onClick={() => {
                    setOpenClusterId(null);
                    onSelectPoi(poi.id);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-full border-2"
                    style={{
                      borderColor: "var(--map-marker-ring)",
                      backgroundColor: getPOIMarkerColor(poi.category),
                    }}
                  />
                  <span className="min-w-0 truncate">{poi.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!selectedPoi ? (
        <div
          className="absolute bottom-24 left-4 z-20 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--bg-card) 86%, transparent)",
            color: "var(--text-secondary)",
          }}
        >
          마커를 눌러 장소를 선택하세요
        </div>
      ) : null}
    </section>
  );
}
