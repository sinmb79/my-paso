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

const CATEGORY_LABELS: Record<string, string> = {
  cultural_heritage: "문화유산",
  historic_site: "역사유적",
  tourist_attraction: "관광명소",
  nature: "자연명소",
  food: "미식장소",
  community: "커뮤니티",
  custom: "기타",
};

export function getPOIMarkerColor(category: POI["category"]) {
  return CATEGORY_COLORS[category] ?? "#fbbf24";
}

export function getPOICategoryLabel(category: POI["category"]) {
  return CATEGORY_LABELS[category] ?? "기타";
}

export function getPOIPopupLabel(poi: POI) {
  return `${poi.name} · ${poi.district}`;
}
