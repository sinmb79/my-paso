import { describe, expect, it } from "vitest";

import { findNearbyPOIs } from "@/lib/geo/geofence";
import type { POI } from "@/types";

const cityHall: POI = {
  id: "city-hall",
  name: "City Hall",
  category: "historic_site",
  latitude: 37.5663,
  longitude: 126.9779,
  geofence_radius_m: 60,
  region: "Seoul",
  district: "Jung-gu",
  source: "test",
  base_xp: 10,
};

const distantPoi: POI = {
  id: "far-away",
  name: "Far Away",
  category: "tourist_attraction",
  latitude: 37.5708,
  longitude: 126.983,
  geofence_radius_m: 60,
  region: "Seoul",
  district: "Jongno-gu",
  source: "test",
  base_xp: 10,
};

describe("findNearbyPOIs", () => {
  it("returns POIs inside the requested radius", () => {
    const matches = findNearbyPOIs(37.56632, 126.97791, [cityHall, distantPoi], 50);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.poi.id).toBe("city-hall");
    expect(matches[0]?.distance).toBeLessThan(50);
  });

  it("sorts matches from nearest to farthest", () => {
    const secondClosePoi: POI = {
      ...cityHall,
      id: "second-close",
      latitude: 37.5665,
      longitude: 126.9782,
    };

    const matches = findNearbyPOIs(
      37.56632,
      126.97791,
      [secondClosePoi, cityHall],
      80,
    );

    expect(matches.map((match) => match.poi.id)).toEqual([
      "city-hall",
      "second-close",
    ]);
  });
});
