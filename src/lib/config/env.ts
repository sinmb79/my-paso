const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function getMapboxAccessToken() {
  const token = MAPBOX_TOKEN?.trim();
  return token ? token : null;
}
