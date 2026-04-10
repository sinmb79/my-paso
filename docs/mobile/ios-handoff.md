# iOS Handoff

맥이 없는 환경에서 만든 `Hello! My Paso!` Capacitor iOS 프로젝트를 macOS/Xcode에서 바로 이어받기 위한 실행 문서다. 이 문서의 목표는 `ios/` 프로젝트를 다시 생성하지 않고, 서명과 시뮬레이터 검증, Archive 순서만 빠르게 밟게 만드는 것이다.  
This document is the execution handoff for the `Hello! My Paso!` Capacitor iOS project prepared from a non-macOS environment. The goal is to continue directly in Xcode without regenerating the `ios/` project.

## Prerequisites

| 항목 | 기준 |
| --- | --- |
| macOS | 최신 안정 버전 권장 |
| Xcode | Capacitor 8을 지원하는 최신 버전 |
| Cocoa / Swift toolchain | Xcode 기본 포함 |
| Node.js | 22 이상 |
| Apple Developer account | 실기기 서명 또는 TestFlight 배포 시 필요 |

| Item | Requirement |
| --- | --- |
| macOS | A recent stable version |
| Xcode | A current version that supports Capacitor 8 |
| Cocoa / Swift toolchain | Included with Xcode |
| Node.js | 22 or newer |
| Apple Developer account | Required for device signing or TestFlight |

## Open And Sign

1. 저장소 루트에서 `npm install`을 실행한다.
2. 필요하면 `npm run build:mobile` 후 `npx cap sync ios`를 다시 실행한다.
3. `npx cap open ios`로 Xcode를 연다.
4. `App` 타깃에서 `Signing & Capabilities`로 이동해 Team을 지정한다.
5. 번들 ID가 조직 정책과 충돌하면 `com.mypaso.app`를 적절히 조정한다.

1. Run `npm install` at the repository root.
2. If needed, rerun `npm run build:mobile` followed by `npx cap sync ios`.
3. Open Xcode with `npx cap open ios`.
4. In the `App` target, go to `Signing & Capabilities` and choose the correct Team.
5. Adjust `com.mypaso.app` if your org needs a different bundle ID.

## Simulator Check

1. iPhone 시뮬레이터 1종과 iPad 시뮬레이터 1종을 선택한다.
2. 앱을 실행해 홈 화면, 맵 셸, 저널 패널이 보이는지 확인한다.
3. Mapbox 토큰이 없으면 fallback UI가 보여도 정상이다.
4. 카메라와 위치 권한 요청 문구가 자연스럽게 뜨는지만 확인한다.

1. Select one iPhone simulator and one iPad simulator.
2. Run the app and confirm the home screen, map shell, and journal panel render.
3. If there is no Mapbox token, the fallback UI is acceptable.
4. Verify that camera and location permission prompts appear with sensible copy.

## WKWebView Persistence Smoke Test

1. 앱 첫 실행 후 POI 더미 데이터와 로컬 저널 UI가 로드되는지 확인한다.
2. 방문 기록 하나를 생성하거나, 최소한 로컬 상태를 변화시키는 상호작용을 수행한다.
3. 앱을 완전히 종료하고 다시 실행한다.
4. 변경한 로컬 상태가 유지되면 통과다.
5. 상태가 사라지면 `storageMode`와 WebView 저장소 제한을 기록하고 iOS 배포를 중단한다.

1. After first launch, verify dummy POIs and the local journal UI load.
2. Create one visit or perform any interaction that changes persisted local state.
3. Fully terminate the app and relaunch it.
4. Pass if the local state is still present.
5. If the state disappears, record the `storageMode` / WebView storage limitation and block iOS release.

## Archive Flow

1. 시뮬레이터 검증이 끝나면 Generic iOS Device로 전환한다.
2. `Product > Archive`를 실행한다.
3. Organizer에서 `Distribute App`을 선택한다.
4. 내부 테스트면 TestFlight, 사내용이면 Ad Hoc 또는 Enterprise 정책에 맞춰 배포한다.

1. After simulator verification, switch to Generic iOS Device.
2. Run `Product > Archive`.
3. In Organizer, choose `Distribute App`.
4. Use TestFlight for internal testing, or the appropriate enterprise/ad hoc path for your team.

## Known Notes

- 윈도우 기준 선행 검증은 Android에서 완료됐다.
- iOS는 `ios/` 프로젝트와 권한 설명문까지 준비된 상태다.
- WKWebView가 `indexeddb` 대신 `memory`로 떨어지면 네이티브 저장소 대체 작업이 먼저 필요하다.

- The prerequisite validation was completed on Android from Windows.
- iOS is prepared through the generated `ios/` project and usage descriptions.
- If WKWebView falls back to `memory` instead of `indexeddb`, a native storage follow-up is required before release.
