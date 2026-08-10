# Hello! My Paso! 0.3.0 release candidate evidence

Candidate: `0.3.0` (`versionCode 6`)

## Candidate metadata

- Release base: `a24b273`; this evidence includes the final responsive model-ID and screenshot correction after that base.
- Verification window: 2026-08-11 00:49–01:19 KST
- Package: `com.mypaso.app`
- Android manifest: `versionCode 6`, `versionName 0.3.0`, `targetSdkVersion 36`
- Privacy policy: [live 0.3.0 policy](https://sinmb79.github.io/my-paso/privacy.html), previously verified current.
- Play Console versionCode 6 availability and policy answers remain console-pending; do not treat this document as a Play submission claim.

## Executed release gates

| Gate | Command or observation | Observed evidence | Status |
|---|---|---|---|
| Full unit test suite | `npm test` | 288 tests across 32 files passed, exit 0 | Passed |
| Typecheck | `npx tsc --noEmit` | exit 0 | Passed |
| Dependency audits | `npm audit --audit-level=high` and production audit | full 0 advisories; production 0 advisories | Passed |
| Lint | `npm run lint` | exit 0 | Passed |
| Web build | `npm run build` | exit 0 | Passed |
| Mobile web build | `npm run build:mobile` | exit 0 | Passed |
| Capacitor Android sync | `npm run cap:sync:android` | exit 0 | Passed |
| Android JVM tests | Gradle release verification | 10 / 10 passed, exit 0 | Passed |
| Android lint | `:app:lintRelease` | `No issues found`, exit 0 | Passed |
| Android connected tests | API 36 connected verification | 3 / 3 passed, exit 0 | Passed |
| Signed release APK | exact final artifact | 9,265,830 bytes; SHA-256 `E04825ABEF301A4AE0822D2F1DBF980337A67DC0D3F30EDBED9D686F5F620A91` | Passed |
| Signed release AAB | exact final artifact | 8,277,246 bytes; SHA-256 `F4F386B760F3A71F4D8BF2DDE89528B41CF93713811C475C77EC832C17584679` | Passed |
| Artifact signing | `apksigner`, `jarsigner`, `bundletool` | signer cert SHA-256 `f5f45c6f143707bca9e61802eeab9efa921c6623f130906f905a6a0b7b6411bc`; `apksigner` exit 0; normal `jarsigner` exit 0 and jar verified; `bundletool validate` exit 0 | Passed |
| Android package inspection | `aapt2` | package `com.mypaso.app`, version 6 / `0.3.0`, target 36 | Passed |
| Android runtime QA | signed APK upgraded on `Medium_Phone_API_36.1` and Android 16 tablet AVD | required flows and screenshots completed | Passed |
| Store screenshots | final files inspected | five files; phone 1080 × 2400, tablet 2560 × 1440; Profile shows the full model ID and tablet app frame has no launcher dock | Passed |
| Scope and secret scan | `git diff --check`, tracked-key extension scan, guarded credential-pattern scan | diff check exit 0; 0 tracked key/keystore files; only four expected identifier/documentation references and no credential values | Passed |
| Play closed-test upload | Play Console | versionCode 6 availability, policy answers, upload and submission still pending | Pending |
| GitHub publication | tag, push, GitHub Release | not yet performed | Pending |

### Signing-verification qualification

Normal `jarsigner` verification completed with exit 0 and reported the JAR verified. Strict `jarsigner` returned exit 4 because the self-signed upload certificate has an invalid PKIX chain; missing timestamp and POSIX-permission/symlink attributes were warnings, not the signer error. This does not claim timestamped or CA-chain signing.

## Android runtime QA observations

- The test-only dummy server was bound to `127.0.0.1:18080`; `adb reverse` supplied the emulator path. No production remote endpoint or personal data was used.
- Connection request: `POST 200`, 174 bytes. Draft request: `POST 200`, 810 bytes.
- The preview showed endpoint, payload, and exclusions; it required an explicit **이 내용으로 AI 초안 만들기** confirmation.
- The response was a validator-compatible Korean draft. Before apply and after apply, the timeline remained `0`; no AI autosave occurred.
- Explicit visit save produced `+20 XP` and one footprint. Force-stop and restart preserved the visit and local-AI settings.
- Runtime public-address rejection was also exercised with `https://8.8.8.8`: the app showed `공개 인터넷 주소는 사용할 수 없습니다.`, disabled Save and Connection test, and produced no fixture request. The loopback setting was then restored and re-saved.
- The rebuilt final APK was installed again with `-r`; retained data remained intact and the Profile footer reported `Hello! My Paso! v0.3.0 · Local-First`.
- Native photo staging was exercised with a repository-owned dummy icon through Android Photo Picker. The selected image appeared as `방문 사진 미리보기 1`, was removed before save, and the temporary emulator media file was deleted; no personal photo was used.
- Sensitive-marker logcat scan: 0 matches. Error logcat scan: 0 errors.
- HTTPS private-LAN end-to-end execution is not claimed. It requires a system-trusted certificate chain, exact IP SAN, and WebView CORS support.

## Artifact locations

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Store screenshots: `docs/mobile/store-assets/screenshot-01-map.png` through `screenshot-05-tablet-landscape.png`

## Remaining release gates

1. Immediately before upload, verify in Play Console that versionCode 6 is unused.
2. Complete the accurate Data safety and policy answers, upload the exact AAB above to closed testing, and submit the release.
3. Push the approved release commit, tag `v0.3.0`, and create the GitHub release.
