import { Geolocation } from "@capacitor/geolocation";

import { isNative } from "@/lib/native/platform";

export type GPSPosition = {
  coords: {
    accuracy: number | null;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    latitude: number;
    longitude: number;
    speed: number | null;
  };
  timestamp: number;
};

function normalizePosition(position: {
  coords: {
    accuracy?: number | null;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    latitude: number;
    longitude: number;
    speed?: number | null;
  };
  timestamp: number;
}): GPSPosition {
  return {
    coords: {
      accuracy: position.coords.accuracy ?? null,
      altitude: position.coords.altitude ?? null,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
      heading: position.coords.heading ?? null,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: position.coords.speed ?? null,
    },
    timestamp: position.timestamp,
  };
}

export async function requestPermissions() {
  if (isNative()) {
    const status = await Geolocation.requestPermissions();
    return (
      status.location === "granted" ||
      status.coarseLocation === "granted"
    );
  }

  return (
    typeof navigator !== "undefined" &&
    typeof navigator.geolocation !== "undefined"
  );
}

export async function getCurrentPosition() {
  if (isNative()) {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
    });
    return normalizePosition(position);
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not available in this environment.");
  }

  return new Promise<GPSPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  }).then(normalizePosition);
}
