import { Preferences } from "@capacitor/preferences";

import { isNative } from "@/lib/native/platform";

export async function getSetting(key: string) {
  if (isNative()) {
    const result = await Preferences.get({ key });
    return result.value;
  }

  return globalThis.localStorage?.getItem(key) ?? null;
}

export async function setSetting(key: string, value: string) {
  if (isNative()) {
    await Preferences.set({ key, value });
    return;
  }

  globalThis.localStorage?.setItem(key, value);
}
