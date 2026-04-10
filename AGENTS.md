<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Hello! My Paso! — Capacitor Mobile Delivery

> Authoritative design spec: `my-paso/docs/superpowers/specs/2026-04-10-capacitor-mobile-delivery-design.md`
> Implementation plan: `my-paso/docs/superpowers/plans/2026-04-10-capacitor-mobile-delivery.md`

## What This Project Is

A gamified life-logging PWA: footsteps, cultural-site visits, and reviews become XP. All data stays on-device (local-first). Phase 0 foundation is **complete** — Next.js 16 static export, wa-sqlite browser DB, 100 dummy POIs, visit/review CRUD, XP engine, level system, JSON export/import, Mapbox map shell. All 13 tests pass, lint clean, build succeeds.

## What We Are Doing Now

Wrapping the existing `out/` static export in a Capacitor shell to produce:
1. **Android debug APK** — built and smoke-tested on Windows (emulator)
2. **iOS Xcode project** — generated with permissions, handed off for macOS signing

## Architecture (Do Not Violate)

```
Next.js 16 static export  ──►  out/  ──►  Capacitor Shell
                                              ├── android/
                                              └── ios/
```

1. **Local-first is sacred.** No server calls for core features. All data on-device.
2. **wa-sqlite stays.** Do NOT replace with Capacitor SQLite. Validate the existing `IDBMinimalVFS` in WebView first. Only if `storageMode` falls back to `memory` on Android, open a follow-up task.
3. **Progressive enhancement.** Gate all native code behind `Capacitor.isNativePlatform()`. The app must keep working as a browser PWA.
4. **`output: "export"` stays.** Capacitor serves the `out/` directory.
5. **No new backend.** Zero API routes, zero server functions.
6. **Build profile split.** GitHub Pages build uses `basePath: "/${repo}"`. Mobile build **must** use `basePath: ""`, `assetPrefix: ""`. Use `MY_PASO_BUILD_TARGET=mobile` env var to switch.

## Build Profile Split (Critical)

The current `next.config.ts` sets `basePath` for GitHub Pages. Capacitor **cannot** use that output — paths like `/my-paso/...` break inside the WebView.

**Required change to `next.config.ts`:**
```typescript
const isMobile = process.env.MY_PASO_BUILD_TARGET === "mobile";
const isGitHubPages = !isMobile && process.env.GITHUB_ACTIONS === "true";
const basePath = isGitHubPages ? `/${repositoryName}` : "";
```

**Required `package.json` scripts:**
```json
{
  "build:mobile": "cross-env MY_PASO_BUILD_TARGET=mobile next build",
  "cap:sync": "npx cap sync",
  "cap:android": "npx cap open android",
  "cap:ios": "npx cap open ios"
}
```

Install `cross-env` as devDependency for Windows compatibility.

## Data Persistence — The Key Acceptance Test

The existing `sqlite.ts` picks `indexeddb` mode only when BOTH `indexedDB` and `navigator.locks` exist. Otherwise it silently falls back to `memory` (data lost on restart).

**Android acceptance test:**
1. After `initializeDatabase()`, verify `storageMode === "indexeddb"`
2. Create a visit, close the app completely, reopen — visit must still exist
3. If `memory` mode is detected, **stop and log the failure**. Do NOT implement a workaround in this phase.

## Permission Handling

Permissions are requested **lazily** (on first use), never at startup. Denial disables only that feature, not the whole app.

| Capability | Android | iOS | On Denial |
|------------|---------|-----|-----------|
| Geolocation | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` | Disable auto-detect, keep manual journaling |
| Camera | `CAMERA` | `NSCameraUsageDescription` | Hide photo attachment, keep text |
| Filesystem | App-private (no runtime permission) | App sandbox | Show failure reason on backup/restore |

## Native Capability Scope (This Phase)

| Do | Don't |
|----|-------|
| Geolocation wrapper skeleton + permission flow | Background location tracking |
| Camera wrapper + call sites | Push notifications |
| Filesystem wrapper for backup/restore | Server sync |
| Preferences wrapper for settings | User accounts |
| Splash/StatusBar cleanup | Store metadata upload |

## File Structure (New Files)

```
my-paso/
├── android/                         # npx cap add android
├── ios/                             # npx cap add ios
├── capacitor.config.ts              # EXISTS — verify and update
├── src/lib/native/
│   ├── platform.ts                  # isNative(), getPlatform()
│   ├── camera.ts                    # takePhoto() — native or <input>
│   ├── filesystem.ts                # backup/restore helpers
│   └── preferences.ts               # settings read/write
├── src/lib/geo/
│   ├── gps-tracker.ts               # getCurrentPosition() — native or web
│   ├── haversine.ts                 # distance calc (pure math)
│   ├── geofence.ts                  # findNearbyPOIs()
│   └── visit-detector.ts            # dwell timer state machine
├── src/hooks/
│   ├── useGPS.ts                    # position + permission state
│   └── useVisitDetection.ts         # polling + geofence + dwell
└── docs/mobile/
    ├── android-setup.md             # env setup + build + test
    └── ios-handoff.md               # signing + checklist for macOS
```

## Test Strategy

| Layer | Tool | Pass Criteria |
|-------|------|---------------|
| Web regression | `npm run test` + `npm run lint` + `npm run build` | All 13+ tests pass, lint clean, build succeeds |
| Capacitor sync | `npx cap sync` | No errors |
| Android build | `./gradlew assembleDebug` (or Android Studio) | APK produced |
| Emulator phone | Portrait AVD | Home/map/journal render |
| Emulator tablet | Landscape AVD | Layout not broken |
| Data persistence | Restart app in emulator | Seed + visits + XP survive |
| Geolocation smoke | Emulator GPS injection | Permission prompt → position or fallback |
| Camera smoke | Emulator | Permission prompt → cancel/deny handled |
| iOS readiness | `npx cap sync ios` | `ios/` project exists, Info.plist has usage descriptions |

## What NOT to Change

- `src/lib/db/migrations.ts` — schema is stable
- `src/lib/db/queries.ts` — queries work as-is
- `src/lib/xp/` — pure logic, no platform dependency
- `src/lib/export/json-export.ts` — works as-is
- `tests/` — existing tests must keep passing
- `public/` — POI seed, icons, manifest stay

## Environment (Already Installed)

| Tool | Path / Version |
|------|---------------|
| Node.js | v22+ |
| Android Studio | `C:\Program Files\Android\Android Studio` |
| JDK (bundled) | OpenJDK 21.0.9 at `Android Studio\jbr\` |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` (API 36/36.1) |
| Build Tools | 35.0.0, 36.1.0 |
| adb | 37.0.0 at `Sdk\platform-tools\` |
| Emulator AVD | `Medium_Phone_API_36.1` |

**Required env vars for CLI builds:**
```
ANDROID_HOME=C:\Users\sinmb\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
PATH+=;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator
```
