const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistance(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  if (latitudeA === latitudeB && longitudeA === longitudeB) {
    return 0;
  }

  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const latARadians = toRadians(latitudeA);
  const latBRadians = toRadians(latitudeB);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latARadians) *
      Math.cos(latBRadians) *
      Math.sin(deltaLongitude / 2) ** 2;

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Math.round(EARTH_RADIUS_METERS * arc);
}
