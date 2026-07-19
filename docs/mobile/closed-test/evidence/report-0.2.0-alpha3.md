# Android 0.2.0-alpha3 실제 POI 업데이트 검증 보고서

기준일: 2026-07-19
앱: Hello! My Paso!
패키지: `com.mypaso.app`
후보: 0.2.0 (`versionCode 4`)
Play 출시명: `0.2.0-alpha3`

## 결론

기능 검증용 더미 POI 100건을 Wikidata CC0 기반 대한민국 실제 장소 100건으로 교체했습니다. 신규 설치와 기존 알파 데이터베이스 마이그레이션을 자동 검증했고, API 35 휴대전화와 API 36 태블릿에서 기존 versionCode 2 위에 versionCode 4 서명 APK를 업데이트 설치했습니다. 두 환경 모두 실제 장소 100건을 표시하고 더미 장소를 표시하지 않았습니다.

서명 AAB·APK, 웹·모바일 빌드, Android·iOS Capacitor 동기화, 휴대전화·태블릿 화면과 로컬 기록 영속성을 통과했습니다. 현재 Play Alpha의 versionCode 3 `0.2.0-alpha2`는 게시 완료 상태이며, 이 versionCode 4 후보는 같은 Alpha 트랙 업로드 직전 상태입니다.

## 서명 산출물

| 항목 | AAB | APK |
|---|---|---|
| 위치 | `android/app/build/outputs/bundle/release/app-release.aab` | `android/app/build/outputs/apk/release/app-release.apk` |
| 크기 | 7,019,128 bytes | 7,747,701 bytes |
| SHA-256 | `FEE02729F0029B3778351662A653C8B428F70F68897AA771E136580CAA7E8A71` | `8B329E9AEE745890831299CD2DB323AC701CA99F2FAF0F8A76B757199AC91290` |
| 버전 | 0.2.0 (4) | 0.2.0 (4) |
| 검증 | Bundletool 1.18.1 validate 통과, JAR 서명 무결성 통과 | apksigner v2 통과 |

업로드 인증서 SHA-256:

    F5:F4:5C:6F:14:37:07:BC:A9:E6:18:02:EE:AB:9E:FA:92:1C:66:23:F1:30:90:6F:90:5A:6A:0B:7B:64:11:BC

Bundle manifest:

- package: `com.mypaso.app`
- version: 0.2.0 (4)
- minSdk: 24
- targetSdk: 36
- allowBackup: false
- 런타임 권한: CAMERA, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION
- 백그라운드 위치 권한: 없음

## POI 데이터 증거

| 항목 | 결과 |
|---|---|
| 시드 버전 | `wikidata-ko-2026-07-19-v1` |
| 스냅샷 날짜 | 2026-07-19 |
| 레코드 수 | 100 |
| 데이터 SHA-256 | `41bf792ce9b610b66900c9439aec332b4422443cf008200029ce669c88485d7e` |
| 라이선스 | Wikidata structured data, CC0 1.0 |
| 카테고리 | 문화유산 20, 유적 20, 관광 20, 자연 20, 음식 10, 커뮤니티 10 |
| AAB 내부 | 고유 `wikidata-Q...` ID 100개, `dummy-poi-` 0개, 테스트 장소명 0개 |

자동 게이트:

1. `P17=Q884` 대한민국과 `P625` 좌표를 가진 승인 유형만 수집
2. 고유 QID·ID·이름, 대한민국 좌표 범위, 카테고리 정원 확인
3. 선택된 좌표 간 25m 미만 중복 차단
4. 레코드별 canonical entity URL과 원본 SPARQL을 매니페스트에 보존
5. POI JSON 원문과 매니페스트 SHA-256 일치 확인

라이선스와 데이터 접근의 공식 근거:

- [Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
- [Wikidata:Data access](https://www.wikidata.org/wiki/Help:Data_access)
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

## 기존 알파 마이그레이션

단순 JSON 교체는 기존 알파 설치에서 실행되지 않으므로 다음 동작을 구현했습니다.

- QID 기반 실제 시드 100건을 앱 시작 때 upsert
- 기존 `source=dummy` 행은 일반 지도·탐색에서 제외
- 더미 행을 물리 삭제하지 않아 과거 방문·리뷰·저장·태그 참조 보존
- 전체 JSON 백업은 레거시 참조 무결성을 위해 원시 POI도 포함

단위 테스트는 기존 더미 POI에 방문을 만든 뒤 실제 시드를 로드해 탐색 목록 100건, 원시 백업 POI 101건, 레거시 방문 보존을 확인했습니다.

## 자동 검증

| 검증 | 결과 |
|---|---|
| `npm test` | 24개 파일, 63개 테스트 통과 |
| `npm run lint` | 통과 |
| `npm audit --audit-level=moderate` | 취약점 0건 |
| `npm run build` | 통과 |
| `npm run build:mobile` | 통과 |
| Android Capacitor sync | 통과 |
| iOS Capacitor sync | 통과 |
| Gradle `testDebugUnitTest` | 통과 |
| Gradle `bundleRelease` | 통과 |
| Gradle `assembleRelease` | 통과 |
| Bundletool validate | 통과 |
| `git diff --check` | 통과 |

## API 35 휴대전화 업데이트 검증

- AVD: `JellyJelly_ReleaseQA_API35`
- 화면: 1080 x 2400, 420 dpi
- WebView: 124.0.6367.219
- 설치 전: versionCode 2, 더미 장소 100건
- 설치 후: versionCode 4, 실제 장소 100건, 더미 표시 0건
- 수동 방문 1건과 5점 회고 1건 생성
- 결과: 32 XP, 방문 장소 1, 회고 1
- 앱 강제 종료·콜드 스타트 후 동일 상태 유지

새로 촬영한 화면:

- `docs/mobile/store-assets/screenshot-01-map.png`
- `docs/mobile/store-assets/screenshot-02-explore.png`
- `docs/mobile/store-assets/screenshot-03-journal.png`
- `docs/mobile/store-assets/screenshot-04-profile.png`

## API 36 태블릿 업데이트 검증

- AVD: `JellyJelly_Pixel_Tablet_API36`
- 화면: 2560 x 1600, 320 dpi, 가로
- 설치 전: versionCode 2
- 설치 후: versionCode 4
- 실제 장소 100건과 `등록 장소` 문구 확인
- 더미 장소 표시 0건
- 가로 지도·선택 카드·하단 탐색 잘림 없음
- 화면: `docs/mobile/store-assets/screenshot-05-tablet-landscape.png`

## Play Console 현재 상태

- `0.2.0-alpha2` versionCode 3: Alpha 게시·활성
- 대상 국가: 대한민국 1개
- 테스터 이메일 목록: `젤리테스터`, 44명
- Play 대시보드: `12명 이상의 테스터가 옵트인함` 완료
- 남은 계정 요건: 12명 이상 14일 연속 옵트인
- 옵트인: `https://play.google.com/apps/testing/com.mypaso.app`
- 설치: `https://play.google.com/store/apps/details?id=com.mypaso.app`

## 남은 위험과 게이트

1. Wikidata `P625`는 출입구가 아니라 장소 중심점일 수 있습니다. GPS 확인 실패 시 수동 기록을 사용하며, 프로덕션 전 중요 POI의 출입구 수준 좌표를 사람 검수합니다.
2. 음식점·시설의 영업 상태는 스냅샷 이후 바뀔 수 있어 공개 전 운영 상태를 표본·위험 기반으로 대조합니다.
3. 최신 Android System WebView 또는 Chrome을 권장합니다. 이번 휴대전화 검증은 WebView 124에서 통과했습니다.
4. 12명 이상 14일 연속 옵트인 조건과 실제 피드백 증거가 남았습니다.
5. Windows에서는 iOS 컴파일·Simulator·실기기·서명 검증을 완료할 수 없습니다. macOS와 Xcode가 필요합니다.
