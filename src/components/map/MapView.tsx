"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

import { getMapboxAccessToken } from "@/lib/config/env";
import { getPOIMarkerColor, getPOIPopupLabel } from "@/components/map/POIMarker";
import type { POI, Visit } from "@/types";

type MapViewProps = {
  pois: POI[];
  status: "loading" | "ready" | "error";
  error: Error | null;
  selectedPoi: POI | null;
  recentVisits: Visit[];
  onSelectPoi: (poiId: string) => void;
};

function MapFallback({
  count,
  selectedPoi,
  recentVisits,
  onSelectPoi,
  pois,
}: {
  count: number;
  selectedPoi: POI | null;
  recentVisits: Visit[];
  onSelectPoi: (poiId: string) => void;
  pois: POI[];
}) {
  const selectedVisit = selectedPoi
    ? recentVisits.find((visit) => visit.poi_id === selectedPoi.id) ?? null
    : null;

  return (
    <section className="rounded-[1.75rem] border border-stone-800 bg-stone-900/70 p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
        Map preview unavailable
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
        Configure <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to activate the
        live Mapbox canvas. Until then, the local-first shell still boots with
        bundled POI data and a working browser database.
      </p>
      <p className="mt-6 text-sm font-medium uppercase tracking-[0.28em] text-amber-300/90">
        {count} bundled dummy POIs are ready
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/60 p-5">
          <h3 className="text-lg font-semibold text-stone-50">Focused POI</h3>
          {selectedPoi ? (
            <>
              <p className="mt-3 text-sm uppercase tracking-[0.2em] text-amber-300/80">
                {selectedPoi.category.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-50">
                {selectedPoi.name}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                {selectedPoi.description ??
                  "Bundled local-first POI ready for journal and review testing."}
              </p>
              <p className="mt-4 text-sm text-stone-400">
                {selectedPoi.region} / {selectedPoi.district}
              </p>
              <p className="mt-2 text-sm text-stone-400">
                Base XP {selectedPoi.base_xp}
              </p>
              <p className="mt-4 text-sm text-emerald-200">
                {selectedVisit
                  ? `Last local visit: ${new Date(selectedVisit.arrived_at).toLocaleString("ko-KR")}`
                  : "No local visit recorded yet for this POI."}
              </p>
            </>
          ) : null}
        </div>
        <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/60 p-5">
          <h3 className="text-lg font-semibold text-stone-50">
            Quick Focus Picks
          </h3>
          <div className="mt-4 grid gap-2">
            {pois.slice(0, 6).map((poi) => (
              <button
                key={poi.id}
                type="button"
                onClick={() => onSelectPoi(poi.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  poi.id === selectedPoi?.id
                    ? "border-amber-300 bg-amber-300/10 text-amber-100"
                    : "border-stone-800 text-stone-300 hover:border-stone-700"
                }`}
              >
                {poi.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MapView({
  pois,
  status,
  error,
  selectedPoi,
  recentVisits,
  onSelectPoi,
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
      <section className="rounded-[1.75rem] border border-stone-800 bg-stone-900/70 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-amber-300/90">
          Preparing local database
        </p>
        <p className="mt-4 text-base leading-7 text-stone-300">
          Loading bundled POIs into the browser-first SQLite layer.
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="rounded-[1.75rem] border border-red-500/40 bg-red-950/30 p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
          Local database unavailable
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          {error?.message ?? "The map shell could not initialize local storage."}
        </p>
      </section>
    );
  }

  if (!token) {
    return (
      <MapFallback
        count={pois.length}
        selectedPoi={selectedPoi}
        recentVisits={recentVisits}
        onSelectPoi={onSelectPoi}
        pois={pois}
      />
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-stone-800 bg-stone-900/70 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
            Local Map Shell
          </h2>
          <p className="mt-2 text-sm leading-7 text-stone-300">
            Live map mode is active with bundled POIs seeded into browser SQLite.
          </p>
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-300/90">
          {pois.length} POIs loaded
        </p>
      </div>
      <div
        ref={mapContainerRef}
        className="h-[420px] rounded-[1.25rem] border border-stone-800"
      />
      {selectedPoi ? (
        <div className="mt-4 rounded-[1.25rem] border border-stone-800 bg-stone-950/50 px-4 py-4">
          <p className="text-sm uppercase tracking-[0.22em] text-amber-300/80">
            Focused POI
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
