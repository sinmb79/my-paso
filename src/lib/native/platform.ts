import { Capacitor } from "@capacitor/core";

export type AppPlatform = "android" | "ios" | "web";

export function isNative() {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): AppPlatform {
  return Capacitor.getPlatform() as AppPlatform;
}
