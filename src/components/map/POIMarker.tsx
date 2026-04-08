import type { POI } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  cultural_heritage: "#f59e0b",
  historic_site: "#f97316",
  tourist_attraction: "#fb7185",
  nature: "#22c55e",
  food: "#38bdf8",
  community: "#c084fc",
  custom: "#e5e7eb",
};

export function getPOIMarkerColor(category: POI["category"]) {
  return CATEGORY_COLORS[category] ?? "#fbbf24";
}

export function getPOIPopupLabel(poi: POI) {
  return `${poi.name} · ${poi.district}`;
}
