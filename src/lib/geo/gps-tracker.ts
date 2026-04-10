import { Geolocation } from "@capacitor/geolocation";

import { isNative } from "@/lib/native/platform";

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
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
    });
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not available in this environment.");
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });
}
