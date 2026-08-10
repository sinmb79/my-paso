import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import capacitorConfig from "../../capacitor.config";

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
    const androidGradle = readFileSync(
      join(root, "android/app/build.gradle"),
      "utf8",
    );

    expect(releaseScript).toContain("[int]$VersionCode = 6");
    expect(releaseScript).toContain(
      `[string]$VersionName = '${packageJson.version}'`,
    );
    expect(androidGradle).toContain(
      "System.getenv('MY_PASO_VERSION_CODE') ?: '6'",
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
    expect(manifest).toContain('android.hardware.location" android:required="false"');
    expect(manifest).toContain('android.hardware.location.gps" android:required="false"');
    expect(manifest).toContain('android.hardware.location.network" android:required="false"');
    expect(manifest).not.toContain("ACCESS_BACKGROUND_LOCATION");
  });

  it("enables Android edge-to-edge before the Capacitor bridge initializes", () => {
    const mainActivity = readFileSync(
      join(
        root,
        "android/app/src/main/java/com/mypaso/app/MainActivity.java",
      ),
      "utf8",
    );

    const noActionBarIndex = mainActivity.indexOf(
      "setTheme(R.style.AppTheme_NoActionBar);",
    );
    const edgeToEdgeIndex = mainActivity.indexOf("EdgeToEdge.enable(this);");
    const bridgeInitIndex = mainActivity.indexOf("super.onCreate(savedInstanceState);");

    expect(noActionBarIndex).toBeGreaterThan(-1);
    expect(edgeToEdgeIndex).toBeGreaterThan(noActionBarIndex);
    expect(bridgeInitIndex).toBeGreaterThan(edgeToEdgeIndex);
  });

  it("keeps Android IME resizing enabled for edge-to-edge screens", () => {
    const manifest = readFileSync(
      join(root, "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );

    expect(manifest).toContain('android:windowSoftInputMode="adjustResize"');
  });

  it("permits Android cleartext only for exact loopback destinations", () => {
    const manifest = readFileSync(
      join(root, "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );
    const networkPolicyPath = join(
      root,
      "android/app/src/main/res/xml/network_security_config.xml",
    );
    expect(existsSync(networkPolicyPath)).toBe(true);
    const networkPolicy = readFileSync(networkPolicyPath, "utf8");
    const document = new DOMParser().parseFromString(networkPolicy, "application/xml");

    expect(document.querySelector("parsererror")).toBeNull();
    expect(manifest).toContain(
      'android:networkSecurityConfig="@xml/network_security_config"',
    );
    expect(manifest).not.toContain("android:usesCleartextTraffic");

    const baseConfig = document.querySelector("network-security-config > base-config");
    expect(baseConfig?.getAttribute("cleartextTrafficPermitted")).toBe("false");

    const cleartextConfigs = Array.from(
      document.querySelectorAll('domain-config[cleartextTrafficPermitted="true"]'),
    );
    expect(cleartextConfigs).toHaveLength(1);
    const domains = Array.from(cleartextConfigs[0].querySelectorAll(":scope > domain"));
    expect(
      domains.map((domain) => ({
        host: domain.textContent?.trim(),
        includeSubdomains: domain.getAttribute("includeSubdomains"),
      })),
    ).toEqual([
      { host: "localhost", includeSubdomains: "false" },
      { host: "127.0.0.1", includeSubdomains: "false" },
      { host: "::1", includeSubdomains: "false" },
    ]);
  });

  it("keeps mixed content and the global Capacitor HTTP patch disabled", () => {
    expect(capacitorConfig.server?.androidScheme).toBe("https");
    expect(capacitorConfig.android?.allowMixedContent).not.toBe(true);
    expect(capacitorConfig.plugins?.CapacitorHttp?.enabled).not.toBe(true);
  });

  it("registers the purpose-built loopback plugin before bridge creation", () => {
    const mainActivity = readFileSync(
      join(
        root,
        "android/app/src/main/java/com/mypaso/app/MainActivity.java",
      ),
      "utf8",
    );

    const registrationIndex = mainActivity.indexOf(
      "registerPlugin(LoopbackAIHttpPlugin.class);",
    );
    const bridgeInitIndex = mainActivity.indexOf("super.onCreate(savedInstanceState);");

    expect(registrationIndex).toBeGreaterThan(-1);
    expect(bridgeInitIndex).toBeGreaterThan(registrationIndex);
  });

  it("installs debug builds alongside the signed release app during QA", () => {
    const androidGradle = readFileSync(
      join(root, "android/app/build.gradle"),
      "utf8",
    );

    expect(androidGradle).toContain('applicationIdSuffix ".debug"');
    expect(androidGradle).toContain('versionNameSuffix "-debug"');
    expect(androidGradle).toContain(
      "signingConfig = signingConfigs.release",
    );
  });

  it("uses Android libraries with Android 15 system-bar guards", () => {
    const packageJson = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
    };
    const androidVariables = readFileSync(
      join(root, "android/variables.gradle"),
      "utf8",
    );

    expect(packageJson.dependencies["@capacitor/android"]).toBe("^8.4.2");
    expect(packageJson.dependencies["@capacitor/core"]).toBe("^8.4.2");
    expect(packageJson.dependencies["@capacitor/camera"]).toBe("^8.2.1");
    expect(androidVariables).toContain("androidxMaterialVersion = '1.14.0'");
  });

  it("keeps Android launcher resources current and removes obsolete template files", () => {
    const wrapper = readFileSync(
      join(root, "android/gradle/wrapper/gradle-wrapper.properties"),
      "utf8",
    );
    const icon = readFileSync(
      join(root, "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"),
      "utf8",
    );
    const roundIcon = readFileSync(
      join(
        root,
        "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml",
      ),
      "utf8",
    );
    const strings = readFileSync(
      join(root, "android/app/src/main/res/values/strings.xml"),
      "utf8",
    );

    expect(wrapper).toContain("gradle-8.14.5-all.zip");
    expect(icon).toContain(
      '<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>',
    );
    expect(roundIcon).toContain(
      '<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>',
    );
    expect(
      existsSync(
        join(root, "android/app/src/main/res/drawable/ic_launcher_monochrome.xml"),
      ),
    ).toBe(true);
    expect(
      existsSync(join(root, "android/app/src/main/res/layout/activity_main.xml")),
    ).toBe(false);
    expect(
      existsSync(
        join(
          root,
          "android/app/src/main/res/drawable/ic_launcher_background.xml",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          root,
          "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml",
        ),
      ),
    ).toBe(false);
    expect(strings).not.toContain('name="package_name"');
    expect(strings).not.toContain('name="custom_url_scheme"');
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
