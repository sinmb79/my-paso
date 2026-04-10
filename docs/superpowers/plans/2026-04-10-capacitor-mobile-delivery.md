# Capacitor Mobile Delivery — Implementation Plan

> **Spec:** `my-paso/docs/superpowers/specs/2026-04-10-capacitor-mobile-delivery-design.md`
> **For agentic workers:** Implement task-by-task. Each task has a verification step. Do NOT skip to the next task until the current one passes.

---

## Pre-flight: Environment Check

- [ ] `node -v` → 22+
- [ ] `java -version` → 17+ (use `C:\Program Files\Android\Android Studio\jbr\bin\java`)
- [ ] `adb version` → responds (use `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb`)
- [ ] `npm run test` → 13 tests pass
- [ ] `npm run lint` → clean
- [ ] `npm run build` → succeeds

Set env vars for this session:
```bash
export ANDROID_HOME="C:\Users\sinmb\AppData\Local\Android\Sdk"
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

---

## Task 1: Build Profile Split

**Goal:** Separate GitHub Pages build from mobile build so Capacitor gets `basePath=""`.

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json` (add scripts + `cross-env`)
- Create: `tests/unit/next-config-mobile.test.ts` (optional — validate env logic)

- [ ] **Step 1: Install cross-env**
```bash
npm install --save-dev cross-env
```

- [ ] **Step 2: Update `next.config.ts`**

Add `MY_PASO_BUILD_TARGET` check. When `mobile`, force `basePath=""` and `assetPrefix=""`.

```typescript
const isMobile = process.env.MY_PASO_BUILD_TARGET === "mobile";
const isGitHubPages = !isMobile && process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "my-paso";
const basePath = isGitHubPages ? `/${repositoryName}` : "";
```

- [ ] **Step 3: Add scripts to `package.json`**
```json
"build:mobile": "cross-env MY_PASO_BUILD_TARGET=mobile next build",
"cap:sync": "npx cap sync",
"cap:sync:android": "npx cap sync android",
"cap:sync:ios": "npx cap sync ios",
"cap:android": "npx cap open android",
"cap:ios": "npx cap open ios"
```

- [ ] **Step 4: Verify**
```bash
npm run test          # still 13+ pass
npm run lint          # clean
npm run build:mobile  # produces out/ with basePath=""
# Check: out/index.html should NOT contain "/my-paso/" paths
npm run build         # still works (GitHub Pages profile)
```

- [ ] **Step 5: Commit**
```
feat: split mobile and web build profiles
```

---

## Task 2: Capacitor Config + Android Platform

**Goal:** Generate `android/` project, sync the mobile `out/` bundle, verify sync succeeds.

**Files:**
- Verify: `capacitor.config.ts` (already exists)
- Generate: `android/` (via `npx cap add android`)

- [ ] **Step 1: Verify `capacitor.config.ts`**

Confirm `webDir: "out"` and `server.androidScheme: "https"`. File already exists — check only.

- [ ] **Step 2: Build mobile export and add Android**
```bash
npm run build:mobile
npx cap add android
npx cap sync android
```

- [ ] **Step 3: Verify Android project**
```bash
# android/ directory exists
# android/app/src/main/assets/public/ contains the web bundle
ls android/app/src/main/assets/public/index.html
```

- [ ] **Step 4: Commit**
```
feat: add android capacitor platform
```

---

## Task 3: Android Debug Build

**Goal:** Produce a debug APK from the command line (no Android Studio needed).

- [ ] **Step 1: Gradle debug build**
```bash
cd android
./gradlew assembleDebug
```

If Gradle wrapper is missing, use:
```bash
gradle wrapper --gradle-version=8.11
./gradlew assembleDebug
```

- [ ] **Step 2: Verify APK**
```bash
ls android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 3: Commit**
```
chore: verify android debug build succeeds
```

---

## Task 4: Emulator Smoke Test

**Goal:** Launch the APK on the existing AVD and verify the app renders.

- [ ] **Step 1: Start emulator**
```bash
emulator -avd Medium_Phone_API_36.1 -no-audio -no-window &
adb wait-for-device
```

- [ ] **Step 2: Install and launch**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.mypaso.app/.MainActivity
```

- [ ] **Step 3: Verify rendering**

Take a screenshot or check logcat:
```bash
adb exec-out screencap -p > emulator-home.png
adb logcat -d | grep -i "paso\|error\|exception" | tail -30
```

**Pass criteria:** App opens, heading visible, no fatal JS errors in logcat.

- [ ] **Step 4: Data persistence acceptance test**

Open the app, let seed POIs load, then:
```bash
# Force stop
adb shell am force-stop com.mypaso.app
# Relaunch
adb shell am start -n com.mypaso.app/.MainActivity
# Screenshot
adb exec-out screencap -p > emulator-restart.png
```

**Pass criteria:** POI data is still present after restart.

If the app shows empty state after restart, check logcat for `storageMode`. If it says `memory`, log this as a **known issue** — do NOT try to fix in this task.

- [ ] **Step 5: Commit results**
```
test: android emulator smoke test passing
```

---

## Task 5: Platform Detection + Native Wrappers

**Goal:** Add `src/lib/native/` utilities gated behind `isNativePlatform()`.

**Files:**
- Create: `src/lib/native/platform.ts`
- Create: `src/lib/native/camera.ts`
- Create: `src/lib/native/filesystem.ts`
- Create: `src/lib/native/preferences.ts`
- Install: `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/preferences`

- [ ] **Step 1: Install Capacitor plugins**
```bash
npm install @capacitor/camera @capacitor/filesystem @capacitor/preferences
npx cap sync
```

- [ ] **Step 2: Create `src/lib/native/platform.ts`**
```typescript
import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'android' | 'ios' | 'web';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): AppPlatform {
  return Capacitor.getPlatform() as AppPlatform;
}
```

- [ ] **Step 3: Create camera wrapper**

`takePhoto()` — on native, use `@capacitor/camera`. On web, create a temporary `<input type="file">` and read as data URL. Return `null` if cancelled.

- [ ] **Step 4: Create filesystem wrapper**

`writeBackupFile(data)` / `readBackupFile()` — on native, use `@capacitor/filesystem` (Documents directory). On web, use download link / file input.

- [ ] **Step 5: Create preferences wrapper**

`getSetting(key)` / `setSetting(key, value)` — thin wrapper around `@capacitor/preferences`. On web, use `localStorage`.

- [ ] **Step 6: Verify**
```bash
npm run test   # existing tests still pass
npm run lint   # clean
```

- [ ] **Step 7: Commit**
```
feat: add platform detection and native capability wrappers
```

---

## Task 6: Geolocation + Geo Utilities

**Goal:** Add GPS wrapper and pure-math geo helpers.

**Files:**
- Install: `@capacitor/geolocation`
- Create: `src/lib/geo/gps-tracker.ts`
- Create: `src/lib/geo/haversine.ts`
- Create: `src/lib/geo/geofence.ts`
- Create: `src/lib/geo/visit-detector.ts`
- Create: `src/hooks/useGPS.ts`
- Create: `tests/unit/haversine.test.ts`
- Create: `tests/unit/geofence.test.ts`
- Create: `tests/unit/visit-detector.test.ts`

- [ ] **Step 1: Install geolocation plugin**
```bash
npm install @capacitor/geolocation
npx cap sync
```

- [ ] **Step 2: Create `gps-tracker.ts`**

`getCurrentPosition()` — native: `@capacitor/geolocation`, web: `navigator.geolocation`. `requestPermissions()` — returns boolean.

- [ ] **Step 3: Create `haversine.ts`**

Pure function: `haversineDistance(lat1, lon1, lat2, lon2) → meters`. No external dependencies.

- [ ] **Step 4: Create `geofence.ts`**

`findNearbyPOIs(lat, lon, pois, radiusMeters)` → sorted array of `{ poi, distance }` within radius.

- [ ] **Step 5: Create `visit-detector.ts`**

State machine: `checkDwell(currentDwellState, nearbyPOI, now)` → `{ dwellState, visitTriggered: poiId | null }`. Dwell threshold = 3 minutes.

- [ ] **Step 6: Create `useGPS.ts` hook**

Exposes: `{ position, loading, error, permissionGranted, requestAccess, updatePosition }`.

- [ ] **Step 7: Write tests**

- `haversine.test.ts`: Seoul City Hall → Gyeongbokgung ≈ 1.5km, same point = 0
- `geofence.test.ts`: POI within/outside 50m radius
- `visit-detector.test.ts`: dwell <3min → no trigger, dwell ≥3min → trigger, POI change resets dwell

- [ ] **Step 8: Verify**
```bash
npm run test   # 13 + new tests pass
npm run lint
```

- [ ] **Step 9: Commit**
```
feat: add geolocation wrapper and geo utility modules
```

---

## Task 7: Android Permissions

**Goal:** Configure AndroidManifest.xml for required capabilities.

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add permissions**
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
```

Note: Filesystem uses app-private storage — no extra permission needed.

- [ ] **Step 2: Rebuild and verify**
```bash
npm run build:mobile
npx cap sync android
cd android && ./gradlew assembleDebug
```

- [ ] **Step 3: Commit**
```
feat: add android permissions for location and camera
```

---

## Task 8: iOS Project + Handoff

**Goal:** Generate `ios/` project with permissions configured. macOS is required for the final build, so prepare a handoff document.

**Files:**
- Generate: `ios/` (via `npx cap add ios`)
- Modify: `ios/App/App/Info.plist`
- Create: `docs/mobile/ios-handoff.md`

- [ ] **Step 1: Add iOS platform**
```bash
npx cap add ios
npx cap sync ios
```

- [ ] **Step 2: Add Info.plist usage descriptions**

Edit `ios/App/App/Info.plist` to include:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to detect visits to cultural sites near you.</string>
<key>NSCameraUsageDescription</key>
<string>Take photos of the places you visit to add to your journal.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Attach photos from your library to visits and reviews.</string>
```

- [ ] **Step 3: Write iOS handoff document**

`docs/mobile/ios-handoff.md` should contain:
- Prerequisites (macOS + Xcode version)
- Steps: `npx cap open ios` → signing setup → simulator run → archive
- WKWebView persistence smoke test checklist (same as Android Task 4 Step 4)
- Known limitations (if any from Android testing)

- [ ] **Step 4: Verify**
```bash
npx cap sync ios  # should succeed even on Windows
ls ios/App/App/Info.plist
```

- [ ] **Step 5: Commit**
```
feat: add ios capacitor project with permissions and handoff doc
```

---

## Task 9: Documentation

**Goal:** Write setup and test docs so anyone can reproduce the Android build.

**Files:**
- Create: `docs/mobile/android-setup.md`
- Update: project-level README if it exists

- [ ] **Step 1: Write `android-setup.md`**

Contents:
- Required tools (Node 22+, JDK 17+, Android Studio, SDK API 36+)
- Env var setup
- Build commands: `npm run build:mobile` → `npx cap sync android` → `./gradlew assembleDebug`
- Emulator commands: `emulator -avd <name>`, `adb install`, `adb shell am start`
- Troubleshooting (common Gradle errors, WASM mime type, WebView storage fallback)

- [ ] **Step 2: Commit**
```
docs: add android setup and ios handoff guides
```

---

## Task 10: Final Verification Pass

**Goal:** Run every acceptance criterion from the spec's test plan.

- [ ] **Web regression**
```bash
npm run test      # all pass
npm run lint      # clean
npm run build     # succeeds (web profile)
npm run build:mobile  # succeeds (mobile profile)
```

- [ ] **Capacitor sync**
```bash
npx cap sync      # no errors
```

- [ ] **Android build**
```bash
cd android && ./gradlew assembleDebug  # APK produced
```

- [ ] **Emulator phone test**

Launch on `Medium_Phone_API_36.1` in portrait. Home/map/journal render.

- [ ] **Data persistence**

Create a visit → force stop → relaunch → visit still exists.

- [ ] **Geolocation smoke** (if emulator supports GPS injection)

Inject coordinates via `adb emu geo fix <lon> <lat>`, verify position or graceful fallback.

- [ ] **iOS readiness**

`ios/` exists, `Info.plist` has all usage descriptions, `docs/mobile/ios-handoff.md` complete.

- [ ] **Final commit**
```
chore: all mobile delivery acceptance tests passing
```

---

## Notes

- **@capacitor/cli** is already in `dependencies`. Consider moving it to `devDependencies` during cleanup.
- **`android/` and `ios/` directories** should be committed to the repo so other developers don't need to regenerate them.
- **Mapbox token:** The fallback UI works without a token. If testing map rendering, set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
- **wa-sqlite WASM:** If Android WebView fails to load the WASM binary, check the MIME type configuration in the Capacitor server config or move the binary to a different path.
