import { haversineDistance } from "@/lib/geo/haversine";
import type { POI } from "@/types";

export type NearbyPOIMatch = {
  poi: POI;
  distance: number;
};

export function findNearbyPOIs(
  latitude: number,
  longitude: number,
  pois: POI[],
  radiusMeters: number,
) {
  return pois
    .map((poi) => ({
      poi,
      distance: haversineDistance(
        latitude,
        longitude,
        poi.latitude,
        poi.longitude,
      ),
    }))
    .filter((match) => match.distance <= Math.min(radiusMeters, match.poi.geofence_radius_m))
    .sort((left, right) => left.distance - right.distance);
}
