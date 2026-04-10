# Mobile Verification 2026-04-10

2026-04-10 기준 `Hello! My Paso!` 모바일 전환 작업의 실제 검증 결과다. 안드로이드는 윈도우에서 직접 빌드와 에뮬레이터 검증을 수행했고, iOS는 프로젝트와 권한 문서 준비 상태를 확인했다.  
This document captures the actual verification results for the `Hello! My Paso!` mobile delivery work as of 2026-04-10. Android was built and checked directly from Windows, while iOS was validated for project readiness and handoff completeness.

## Web Regression

| 항목 | 결과 |
| --- | --- |
| `npm run test` | 통과, 13 files / 28 tests |
| `npm run lint` | 통과 |
| `npm run build` | 통과 |
| `npm run build:mobile` | 통과 |
| `npx cap sync` | Android / iOS 모두 통과 |

| Check | Result |
| --- | --- |
| `npm run test` | Passed, 13 files / 28 tests |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run build:mobile` | Passed |
| `npx cap sync` | Passed for both Android and iOS |

## Android Build

| 항목 | 결과 |
| --- | --- |
| APK 생성 | `android/app/build/outputs/apk/debug/app-debug.apk` 생성 확인 |
| Gradle 실행 | 경로의 특수 문자 때문에 `subst P:` 우회 필요 |
| 플러그인 | Camera / Filesystem / Geolocation / Preferences 모두 sync 반영 |

| Check | Result |
| --- | --- |
| APK output | Verified at `android/app/build/outputs/apk/debug/app-debug.apk` |
| Gradle execution | Required `subst P:` because the repo path contains non-ASCII characters |
| Plugins | Camera / Filesystem / Geolocation / Preferences were all synced |

## Android Runtime Smoke Test

| 항목 | 결과 |
| --- | --- |
| 앱 실행 | `com.mypaso.app/.MainActivity` 기동 확인 |
| WebView 로드 | `app:id/webview`가 Activity top dump에 표시됨 |
| 기본 폰 뷰 | WebView bounds `0,63-1080,2337` 확인 |
| large-screen 검증 | 별도 태블릿 AVD는 없어서 `wm size 2560x1600`, `wm density 320` override로 검증 |
| large-screen 뷰 | WebView bounds `0,48-2560,1536` 확인 |

| Check | Result |
| --- | --- |
| App launch | Confirmed `com.mypaso.app/.MainActivity` started |
| WebView load | `app:id/webview` appears in the activity top dump |
| Base phone view | WebView bounds `0,63-1080,2337` confirmed |
| Large-screen verification | No dedicated tablet AVD was installed, so verification used `wm size 2560x1600` and `wm density 320` overrides |
| Large-screen view | WebView bounds `0,48-2560,1536` confirmed |

## Data Persistence

앱 재실행 전후 모두 `run-as com.mypaso.app ls -R app_webview/Default/IndexedDB` 결과에서 `https_localhost_0.indexeddb.leveldb`가 유지됐다. 이 단계 기준 Android WebView는 메모리 폴백이 아니라 IndexedDB 저장소를 유지하는 것으로 판단한다.  
Before and after a force-stop / relaunch cycle, `run-as com.mypaso.app ls -R app_webview/Default/IndexedDB` continued to show `https_localhost_0.indexeddb.leveldb`. For this phase, Android WebView is treated as persisting through IndexedDB rather than falling back to memory.

## Geolocation Smoke

`adb emu geo fix 126.9779 37.5663` 명령이 성공했고, 앱은 위치 주입 직후 비정상 종료 없이 계속 실행됐다. 현재 위치 표시 UI는 아직 연결하지 않았기 때문에, 이 단계의 합격 기준은 `geolocation wrapper 단위 테스트 통과 + emulator geo injection 후 무크래시`다.  
`adb emu geo fix 126.9779 37.5663` succeeded, and the app remained running without a crash after location injection. Because no visible location UI is wired yet, the phase-level pass condition is `geolocation wrapper unit tests passing + no crash after emulator geo injection`.

## iOS Readiness

| 항목 | 결과 |
| --- | --- |
| `ios/` 프로젝트 | 생성 완료 |
| `Info.plist` 권한 문구 | Camera / Location / Photo Library 모두 추가 완료 |
| handoff 문서 | `docs/mobile/ios-handoff.md` 작성 완료 |
| 남은 작업 | macOS + Xcode에서 signing, simulator, WKWebView persistence 확인 |

| Check | Result |
| --- | --- |
| `ios/` project | Generated |
| `Info.plist` usage descriptions | Camera / Location / Photo Library all present |
| Handoff guide | `docs/mobile/ios-handoff.md` completed |
| Remaining work | Signing, simulator verification, and WKWebView persistence on macOS + Xcode |

## Notes

- 별도 태블릿 AVD가 없는 점은 한계지만, large-screen override 검증으로 최소한 레이아웃 범위는 확인했다.
- Android 쪽은 실제 배포 전환에 필요한 셸, 빌드, 설치, 재기동 영속성까지 검증 완료 상태다.
- iOS는 윈도우 한계상 최종 실행 대신 handoff completeness까지 마쳤다.

- The lack of a dedicated tablet AVD is a limitation, but the large-screen override still validated the responsive layout range.
- On Android, the shell, build, install flow, and persistence-after-restart checks are all complete.
- On iOS, the final runtime step remains blocked on macOS, but the project and handoff are ready.
