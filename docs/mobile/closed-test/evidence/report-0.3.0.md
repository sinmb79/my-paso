# Hello! My Paso! 0.3.0 release candidate evidence

Candidate: `0.3.0` (`versionCode 6`)

This file is an evidence shell. A checked item must cite an observed command,
timestamp, exit code, and any produced artifact. Until then, every release gate
below is pending; it is not a claim that the gate passed.

## Candidate metadata

- Package manifest and lockfile root: `0.3.0`
- Android defaults: `versionName 0.3.0`, `versionCode 6`
- Play status recorded on 2026-08-11: `0.2.0-alpha3` / versionCode 4 is the
  published Alpha version; `0.2.0-alpha4` / versionCode 5 was submitted on
  2026-07-30 and is recorded as under review. Confirm versionCode 6 remains
  unused in Play Console immediately before upload.
- Privacy-policy effective date: 2026-08-11

## Release gates — pending execution

| Gate | Command or observation | Required evidence | Status |
|---|---|---|---|
| Focused version test | `npm test -- tests/unit/release-version.test.ts tests/unit/native-config.test.ts` | test count and exit code | Pending |
| Full unit test suite | `npm test` | test count and exit code | Pending |
| Typecheck | `npx tsc --noEmit` | exit code | Pending |
| Dependency audit | `npm audit --audit-level=high` | zero high-or-higher advisories and exit code | Pending |
| Lint | `npm run lint` | exit code | Pending |
| Web build | `npm run build` | exit code | Pending |
| Mobile web build | `npm run build:mobile` | exit code | Pending |
| Capacitor Android sync | `npm run cap:sync:android` | exit code | Pending |
| Android unit/lint/APK | `android\\gradlew.bat :app:testDebugUnitTest :app:lintRelease :app:assembleRelease --no-daemon --console=plain` | exit code, APK path, lint result | Pending |
| Signed AAB | `npm run android:bundle:release -- -VersionCode 6 -VersionName 0.3.0` | path, byte size, SHA-256, signing verification | Pending |
| Android runtime QA | install the exact release APK and exercise required 0.3.0 flows | device/API, screenshots, observed result | Pending |
| Play closed-test upload | Console check, exact AAB upload, policy/listing/release-note submission | track, version code, submission state, blocking errors | Pending |
| GitHub publication | tag `v0.3.0`, push, release creation | commit, tag, release URL | Pending |
| Scope check | `git diff --check` and tracked-secret scan | exit code and findings | Pending |

## Expected artifact locations

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Store screenshots: `docs/mobile/store-assets/screenshot-01-map.png` through
  `screenshot-05-tablet-landscape.png`

## Evidence recording template

```text
Timestamp (Asia/Seoul):
Command / observation:
Exit code / result:
Test count (when applicable):
Artifact path, bytes, SHA-256 (when applicable):
Failure, retry, or limitation:
```
