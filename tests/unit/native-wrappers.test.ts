import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorState = {
  isNative: false,
  platform: "web",
};

const cameraState = {
  result: { dataUrl: "data:image/jpeg;base64,native-photo" },
};

const filesystemState = {
  result: { uri: "file:///documents/paso-backup.json" },
};

const shareMock = vi.fn(async () => ({ activityType: "test" }));
const preferenceValues = new Map<string, string>();
const preferenceRemoveMock = vi.fn(async ({ key }: { key: string }) => {
  preferenceValues.delete(key);
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => capacitorState.isNative,
    getPlatform: () => capacitorState.platform,
  },
}));

vi.mock("@capacitor/camera", () => ({
  Camera: {
    getPhoto: vi.fn(async () => cameraState.result),
  },
  CameraResultType: {
    DataUrl: "dataUrl",
  },
  CameraSource: {
    Prompt: "prompt",
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: {
    Documents: "DOCUMENTS",
  },
  Encoding: {
    UTF8: "utf8",
  },
  Filesystem: {
    writeFile: vi.fn(async () => filesystemState.result),
  },
}));

vi.mock("@capacitor/share", () => ({
  Share: {
    canShare: vi.fn(async () => ({ value: true })),
    share: shareMock,
  },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: preferenceValues.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferenceValues.set(key, value);
    }),
    remove: preferenceRemoveMock,
  },
}));

describe("native wrappers", () => {
  beforeEach(() => {
    capacitorState.isNative = false;
    capacitorState.platform = "web";
    localStorage.clear();
    shareMock.mockClear();
    preferenceRemoveMock.mockClear();
    preferenceValues.clear();
  });

  it("reports the active platform through Capacitor", async () => {
    capacitorState.isNative = true;
    capacitorState.platform = "android";

    const { getPlatform, isNative } = await import("@/lib/native/platform");

    expect(isNative()).toBe(true);
    expect(getPlatform()).toBe("android");
  });

  it("stores settings in localStorage on the web", async () => {
    const { getSetting, setSetting } = await import("@/lib/native/preferences");

    await setSetting("map-style", "classic");

    expect(await getSetting("map-style")).toBe("classic");
  });

  it("removes a setting from localStorage on the web", async () => {
    const { getSetting, removeSetting, setSetting } = await import(
      "@/lib/native/preferences"
    );
    await setSetting("map-style", "classic");

    await removeSetting("map-style");

    await expect(getSetting("map-style")).resolves.toBeNull();
  });

  it("removes a setting through Capacitor Preferences on native platforms", async () => {
    capacitorState.isNative = true;
    const { removeSetting } = await import("@/lib/native/preferences");

    await removeSetting("map-style");

    expect(preferenceRemoveMock).toHaveBeenCalledWith({ key: "map-style" });
  });

  it.each([
    "{",
    JSON.stringify({
      enabled: true,
      vendor: "naver",
      endpoint: "http://user:password@127.0.0.1:8000",
      model: "local-korean-model",
      capability: "text",
      confirmedPrivateLANEndpoint: null,
    }),
    JSON.stringify({
      enabled: true,
      vendor: "naver",
      endpoint: "http://8.8.8.8:8000",
      model: "local-korean-model",
      capability: "text",
      confirmedPrivateLANEndpoint: null,
    }),
  ])("purges malformed or unsafe legacy local-AI settings on native", async (legacyValue) => {
    capacitorState.isNative = true;
    const key = "paso.local-ai.settings";
    preferenceValues.set(key, legacyValue);
    const { loadLocalAISettings } = await import("@/lib/ai/preferences");

    await expect(loadLocalAISettings()).resolves.toBeNull();

    expect(preferenceRemoveMock).toHaveBeenCalledWith({ key });
    expect(preferenceValues.has(key)).toBe(false);
  });

  it("does not remove an absent local-AI setting on native", async () => {
    capacitorState.isNative = true;
    const { loadLocalAISettings } = await import("@/lib/ai/preferences");

    await expect(loadLocalAISettings()).resolves.toBeNull();

    expect(preferenceRemoveMock).not.toHaveBeenCalled();
  });

  it("reads a native camera photo when running natively", async () => {
    capacitorState.isNative = true;
    capacitorState.platform = "android";

    const { takePhoto } = await import("@/lib/native/camera");

    await expect(takePhoto()).resolves.toBe(
      "data:image/jpeg;base64,native-photo",
    );
  });

  it("writes backups through the native filesystem when running natively", async () => {
    capacitorState.isNative = true;
    capacitorState.platform = "android";

    const { writeBackupFile } = await import("@/lib/native/filesystem");

    await expect(
      writeBackupFile("paso-backup.json", "{\"hello\":\"paso\"}"),
    ).resolves.toBe("file:///documents/paso-backup.json");
  });

  it("opens the native share sheet for a written backup", async () => {
    capacitorState.isNative = true;
    capacitorState.platform = "android";

    const { shareBackupFile } = await import("@/lib/native/share");

    await expect(
      shareBackupFile(
        "file:///documents/paso-backup.json",
        "paso-backup.json",
      ),
    ).resolves.toBe(true);
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ["file:///documents/paso-backup.json"],
        dialogTitle: "백업 파일 보관하기",
      }),
    );
  });
});
