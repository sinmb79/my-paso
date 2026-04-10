import { describe, expect, it } from "vitest";

import { haversineDistance } from "@/lib/geo/haversine";

describe("haversineDistance", () => {
  it("returns zero for the same coordinates", () => {
    expect(haversineDistance(37.5663, 126.9779, 37.5663, 126.9779)).toBe(0);
  });

  it("measures the distance between Seoul City Hall and Gyeongbokgung", () => {
    const distance = haversineDistance(37.5663, 126.9779, 37.5796, 126.977);

    expect(distance).toBeGreaterThan(1400);
    expect(distance).toBeLessThan(1700);
  });
});
