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

describe("native wrappers", () => {
  beforeEach(() => {
    capacitorState.isNative = false;
    capacitorState.platform = "web";
    localStorage.clear();
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
});
