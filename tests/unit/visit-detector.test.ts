import { describe, expect, it } from "vitest";

import {
  checkDwell,
  createEmptyDwellState,
} from "@/lib/geo/visit-detector";
import type { POI } from "@/types";

const samplePoi: POI = {
  id: "gyeongbokgung",
  name: "Gyeongbokgung",
  category: "cultural_heritage",
  latitude: 37.5796,
  longitude: 126.977,
  geofence_radius_m: 75,
  region: "Seoul",
  district: "Jongno-gu",
  source: "test",
  base_xp: 25,
};

describe("checkDwell", () => {
  it("does not trigger a visit before the dwell threshold", () => {
    const started = checkDwell(createEmptyDwellState(), {
      poi: samplePoi,
      distance: 12,
    }, "2026-04-10T12:00:00.000Z");

    const result = checkDwell(
      started.dwellState,
      { poi: samplePoi, distance: 8 },
      "2026-04-10T12:02:59.000Z",
    );

    expect(result.visitTriggered).toBeNull();
  });

  it("triggers exactly once after three minutes", () => {
    const started = checkDwell(createEmptyDwellState(), {
      poi: samplePoi,
      distance: 12,
    }, "2026-04-10T12:00:00.000Z");

    const triggered = checkDwell(
      started.dwellState,
      { poi: samplePoi, distance: 6 },
      "2026-04-10T12:03:00.000Z",
    );

    const repeated = checkDwell(
      triggered.dwellState,
      { poi: samplePoi, distance: 6 },
      "2026-04-10T12:04:00.000Z",
    );

    expect(triggered.visitTriggered).toBe("gyeongbokgung");
    expect(repeated.visitTriggered).toBeNull();
  });

  it("resets dwell tracking when the nearby POI changes", () => {
    const otherPoi = {
      ...samplePoi,
      id: "deoksugung",
      name: "Deoksugung",
    };

    const started = checkDwell(createEmptyDwellState(), {
      poi: samplePoi,
      distance: 12,
    }, "2026-04-10T12:00:00.000Z");

    const switched = checkDwell(
      started.dwellState,
      { poi: otherPoi, distance: 10 },
      "2026-04-10T12:01:00.000Z",
    );

    expect(switched.visitTriggered).toBeNull();
    expect(switched.dwellState.poiId).toBe("deoksugung");
    expect(switched.dwellState.firstSeenAt).toBe("2026-04-10T12:01:00.000Z");
  });
});
