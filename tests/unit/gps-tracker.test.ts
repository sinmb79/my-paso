import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorState = {
  isNative: false,
};

const geolocationState = {
  position: {
    coords: {
      latitude: 37.5663,
      longitude: 126.9779,
      accuracy: 5,
    },
    timestamp: 1,
  },
};

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => capacitorState.isNative,
    getPlatform: () => "web",
  },
}));

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn(async () => geolocationState.position),
    requestPermissions: vi.fn(async () => ({ location: "granted" })),
  },
}));

describe("gps tracker", () => {
  beforeEach(() => {
    capacitorState.isNative = false;
  });

  it("uses the browser geolocation API on the web", async () => {
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          success: (position: typeof geolocationState.position) => void,
        ) => success(geolocationState.position),
      },
    });

    const { getCurrentPosition } = await import("@/lib/geo/gps-tracker");

    await expect(getCurrentPosition()).resolves.toEqual(geolocationState.position);
  });

  it("reports permission access as granted when native permission succeeds", async () => {
    capacitorState.isNative = true;

    const { requestPermissions } = await import("@/lib/geo/gps-tracker");

    await expect(requestPermissions()).resolves.toBe(true);
  });
});
