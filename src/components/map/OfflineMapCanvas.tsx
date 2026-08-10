"use client";

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

function getVisibleMarkers(pois: POI[], selectedPoi: POI | null) {
  const step = Math.max(1, Math.ceil(pois.length / 36));
  const markers = pois.filter((_, index) => index % step === 0).slice(0, 36);

  if (selectedPoi && !markers.some((poi) => poi.id === selectedPoi.id)) {
    markers.push(selectedPoi);
  }

  return markers;
}

export function OfflineMapCanvas({
  pois,
  selectedPoi,
  onSelectPoi,
  fullscreen,
}: OfflineMapCanvasProps) {
  const markerPois = getVisibleMarkers(pois, selectedPoi);
  const markerBounds = getMarkerBounds(pois);

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
        {markerPois.map((poi) => {
          const position = getMarkerPosition(poi, markerBounds);
          const selected = poi.id === selectedPoi?.id;
          const color = getPOIMarkerColor(poi.category);

          return (
            <button
              key={poi.id}
              type="button"
              aria-label={`${poi.name} 선택`}
              title={`${poi.name} · ${getPOICategoryLabel(poi.category)}`}
              onClick={() => onSelectPoi(poi.id)}
              className="absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition active:scale-90"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                zIndex: selected ? 10 : 1,
              }}
            >
              <span
                className={`grid place-items-center rounded-full ${
                  selected
                    ? "h-10 w-10 border-[3px] shadow-lg"
                    : "h-3.5 w-3.5 border-2"
                }`}
                style={{
                  borderColor: selected ? color : "var(--map-marker-ring)",
                  backgroundColor: selected ? "var(--bg-card)" : color,
                  boxShadow: selected ? `0 8px 24px color-mix(in srgb, ${color} 38%, transparent)` : undefined,
                }}
              >
                {selected ? (
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

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
