# Android 비공개 테스트 로컬 검증 보고서

> 역사 기록: 이 문서는 2026-07-16의 `0.1.0` (`versionCode 1`) 로컬 검증 스냅샷입니다. 현재 게시된 alpha2는 `report-0.2.0.md`, 다음 alpha3 후보는 `report-0.2.0-alpha3.md`를 기준으로 합니다. 아래 경로의 로컬 산출물은 후속 빌드로 교체됐습니다.

기준일: 2026-07-16
앱: `Hello! My Paso!`
패키지: `com.mypaso.app`

## 업로드 산출물

| 항목 | 결과 |
|---|---|
| AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| 버전 | `0.1.0` (`versionCode 1`) |
| 파일 크기 | 6,909,349 bytes |
| SHA-256 | `45DF703641EBAB2CFD9052A750A7B1A661C3C373E0EE87F72DC9B23A44ADD59D` |
| 대상 SDK | Android API 36 |
| Bundletool validate | 통과 |
| JAR 서명 | 통과 |
| 업로드 인증서 일치 | 통과 |

## 번들 정책 점검

| 점검 | 결과 |
|---|---|
| 요청 권한 | `INTERNET`, `ACCESS_NETWORK_STATE`, 앱 내부 동적 리시버 권한 |
| 민감 런타임 권한 | 0개 |
| Android 자동 백업·기기 이전 | 비활성화 |
| 개인정보처리방침 | 번들에 포함 |
| 공개 정책 URL | `https://sinmb79.github.io/my-paso/privacy.html` (`HTTP 200`) |
| Mapbox 공개 토큰 | 미포함 |
| 모바일 서비스워커 등록 | 미포함 |
| 네이티브 `.so` 라이브러리 | 0개 |
| 릴리스 디버그 가능 플래그 | 비활성화 |

## 실제 기기 프로필 검증

### 휴대전화

- AVD: `JellyJelly_AOSP_API35`
- Android: API 35
- 화면: 1080 x 2400, 420 dpi
- 설치 방식: 최종 AAB에서 Bundletool이 생성한 기기별 릴리스 분할 APK
- 결과: `0.1.0 (1)`, 대상 API 36, 포그라운드 실행, 크래시 버퍼 0건
- 화면 증거: `phone-release-map.png`

### 태블릿

- AVD: `JellyJelly_Pixel_Tablet_API36`
- Android: API 36
- 화면: 2560 x 1600, 320 dpi
- 검증 방향: 세로 및 가로
- 설치 방식: 최종 AAB에서 Bundletool이 생성한 기기별 릴리스 분할 APK
- 결과: `0.1.0 (1)`, 대상 API 36, 가로 레이아웃 정상, 포그라운드 실행, 크래시 버퍼 0건
- 화면 증거: `tablet-release-landscape-map.png`

## 로컬 데이터 영속성

릴리스와 동일한 동기화된 모바일 웹 자산을 디버그 셸에 설치해 DOM 수준으로 다음 흐름을 자동 검증했습니다. 최종 검증 뒤에는 디버그 앱을 제거하고 위 릴리스 분할 APK를 다시 설치했습니다.

1. `테스트 문화유산 01`에 방문 메모를 저장했습니다.
2. 별점 5점과 리뷰를 저장했습니다.
3. IndexedDB 데이터베이스 `paso-local.db` 생성을 확인했습니다.
4. 앱 프로세스를 강제 종료하고 재실행했습니다.
5. 프로필에서 방문 1건, 리뷰 1건, 30 XP와 리뷰 원문이 유지됨을 확인했습니다.
6. 같은 디버그 APK를 업데이트 설치한 뒤에도 데이터가 유지됨을 확인했습니다.

화면 증거: `phone-persistence-after-relaunch.png`

## 자동 검증

- `npm test`: 테스트 파일 14개, 테스트 28개 통과
- `npm run lint`: 통과
- `npm audit`: 프로덕션·개발 의존성 취약점 0건
- Next.js `16.2.10` 및 PostCSS `8.5.19`: 웹·모바일 정적 빌드 통과
- `npm run android:bundle:release`: 통과
- 휴대전화·태블릿 Bundletool 설치 및 콜드 스타트: 통과

## 남은 외부 절차

로컬 개발과 검증은 완료됐지만 아래 항목은 Play Console 계정에서 수행해야 합니다.

1. AAB 업로드와 Play App Signing 승인
2. 앱 콘텐츠·데이터 보안·콘텐츠 등급 제출
3. 스토어 문구와 그래픽 업로드
4. 실제 테스터 15명 이상 등록 및 옵트인 링크 발송
5. 12명 이상이 14일 연속 옵트인한 상태 유지
6. 피드백과 수정 증거를 첨부해 프로덕션 액세스 신청

공개 프로덕션 전에는 더미 POI 100건을 출처·좌표·라이선스가 검증된 실제 POI로 교체해야 합니다.
