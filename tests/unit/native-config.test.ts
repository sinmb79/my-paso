import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("native privacy and permission configuration", () => {
  it("disables Capacitor bridge payload logging for private local data", () => {
    const capacitorConfig = readFileSync(
      join(root, "capacitor.config.ts"),
      "utf8",
    );

    expect(capacitorConfig).toContain('loggingBehavior: "none"');
  });

  it("keeps the Android release script aligned with the app version", () => {
    const packageJson = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { version: string };
    const releaseScript = readFileSync(
      join(root, "scripts/build-android-release.ps1"),
      "utf8",
    );

    expect(releaseScript).toContain("[int]$VersionCode = 2");
    expect(releaseScript).toContain(
      `[string]$VersionName = '${packageJson.version}'`,
    );
  });

  it("declares only the Android foreground location and optional camera permissions", () => {
    const manifest = readFileSync(
      join(root, "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );

    expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
    expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
    expect(manifest).toContain("android.permission.CAMERA");
    expect(manifest).toContain('android.hardware.camera" android:required="false"');
    expect(manifest).not.toContain("ACCESS_BACKGROUND_LOCATION");
  });

  it("includes iOS usage descriptions, Files sharing keys, and the Filesystem privacy reason", () => {
    const info = readFileSync(join(root, "ios/App/App/Info.plist"), "utf8");
    const privacy = readFileSync(
      join(root, "ios/App/App/PrivacyInfo.xcprivacy"),
      "utf8",
    );
    const project = readFileSync(
      join(root, "ios/App/App.xcodeproj/project.pbxproj"),
      "utf8",
    );

    expect(info).toContain("NSLocationAlwaysAndWhenInUseUsageDescription");
    expect(info).toContain("UIFileSharingEnabled");
    expect(info).toContain("LSSupportsOpeningDocumentsInPlace");
    expect(privacy).toContain("NSPrivacyAccessedAPICategoryFileTimestamp");
    expect(privacy).toContain("C617.1");
    expect(project).toContain("PrivacyInfo.xcprivacy in Resources");
  });
});
