# Android 0.2.0 비공개 테스트 후보 검증 보고서

기준일: 2026-07-19
앱: Hello! My Paso!
패키지: com.mypaso.app
후보: 0.2.0 (versionCode 2)

## 결론

Android 비공개 테스트에 올릴 서명 AAB와 APK를 생성했고, 자동 검증과 휴대전화·태블릿 실제 앱 흐름을 통과했습니다. 로컬 기록의 강제 종료·업데이트 영속성, 민감 로그 차단, JSON 내보내기, 앱 데이터 초기화 후 전체 복원을 확인했습니다. Play Console 제출과 실제 테스터 운영은 외부 절차로 남아 있습니다.

## 서명 산출물

| 항목 | AAB | APK |
|---|---|---|
| 위치 | android/app/build/outputs/bundle/release/app-release.aab | android/app/build/outputs/apk/release/app-release.apk |
| 크기 | 7,017,388 bytes | 7,745,957 bytes |
| SHA-256 | 0777BAABF9D27EA06C4D8D96E512EA729F23D7B656B1BAE1E59EF83C63D13585 | F9FC773866FAC286770C1967023F5D351182DA41B6B1B46AEE44C7E0A30C5754 |
| 검증 | Bundletool validate 통과 | apksigner v2 통과 |
| 인증서 | 업로드 키와 일치 | 업로드 키와 일치 |

업로드 인증서 SHA-256:

    F5:F4:5C:6F:14:37:07:BC:A9:E6:18:02:EE:AB:9E:FA:92:1C:66:23:F1:30:90:6F:90:5A:6A:0B:7B:64:11:BC

Bundle manifest:

- package: com.mypaso.app
- version: 0.2.0 (2)
- minSdk: 24
- targetSdk: 36
- allowBackup: false
- 런타임 권한: CAMERA, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION
- 백그라운드 위치 권한: 없음

## 자동 검증

| 검증 | 결과 |
|---|---|
| npm test | 23개 파일, 60개 테스트 통과 |
| npm run lint | 통과 |
| npm audit --audit-level=moderate | 취약점 0건 |
| npm run build | 통과 |
| npm run build:mobile | 통과 |
| npm run cap:sync | Android·iOS 및 플러그인 5개 동기화 통과 |
| native-config 단위 테스트 | 4개 통과 |
| Gradle testDebugUnitTest | 통과 |
| Gradle assembleDebug | 통과 |
| Gradle bundleRelease | 통과 |
| Gradle assembleRelease | 통과 |
| git diff --check | 통과 |

생성된 Android·iOS Capacitor 설정에서 loggingBehavior는 none입니다.

## 휴대전화 검증

- AVD: JellyJelly_ReleaseQA_API35
- Android: API 35
- 화면: 1080 x 2400
- WebView: 124
- 서명 릴리스 APK 설치: 통과
- 0.2.0 (2) 콜드 스타트 화면 준비: 약 7.9초
- 크래시·ANR: 없음
- 화면 증거: phone-release-0.2.0.png

검증한 사용자 흐름:

1. 지도와 100개 번들 POI 렌더링
2. 탐색, 저장 장소, 사용자 태그, 검색·필터, 상세 화면
3. 포그라운드 GPS 확인과 수동 방문 라벨
4. 방문 메모와 사진, 별점·리뷰
5. 저널 타임라인과 실제 기념일
6. 프로필 27 XP, 방문 1건, 사진 1건, 월간 회고와 업적
7. 프로세스 강제 종료와 같은 APK 업데이트 설치 후 기록 유지

## 백업·복원과 로그 검증

1. 전체 JSON 백업을 실행해 Documents/paso-backup-2026-07-19.json 생성을 확인했습니다.
2. 파일 크기는 79,623 bytes였습니다.
3. 로그에는 파일명만 나타났고 JSON 본문, base64 사진, 방문 좌표, 메모 release_memory는 나타나지 않았습니다.
4. 앱 데이터를 초기화한 뒤에도 외부 Documents 백업 파일이 남는 것을 확인했습니다.
5. Android 시스템 파일 선택기로 백업을 선택했습니다.
6. 무결성 미리보기에서 장소 100, 방문 1, 리뷰 0, XP 기록 3, 저장 상태 1, 사진 1을 확인했습니다.
7. 복원 후 프로필 27 XP, 방문 1, 사진 1과 저널의 GPS 확인 기록·메모·사진이 돌아왔습니다.

화면 증거:

- phone-restore-0.2.0.png
- phone-timeline-0.2.0.png

AOSP 에뮬레이터에는 공유 가능한 앱이 없어 공유 시트가 No apps can perform this action을 표시했지만, 백업 파일 생성과 파일 선택기 복원은 정상 동작했습니다.

## 태블릿 검증

- AVD: JellyJelly_Pixel_Tablet_API36
- Android: API 36
- 화면: 2560 x 1600, 320 dpi
- WebView: 134
- 서명 릴리스 APK 설치: 통과
- 0.2.0 (2) 콜드 스타트 화면 준비: 약 8.8초
- 지도·탐색 2열·프로필 가로 레이아웃: 잘림 없음
- 크래시·ANR: 없음
- 화면 증거: tablet-release-0.2.0.png

콜드 스타트 수치는 Windows의 창 없는 소프트웨어 렌더링 에뮬레이터 측정값이며 실제 기기 성능을 대표하지 않습니다.

## 개인정보·권한 판단

- 개발자·제3자 서버 수집 및 공유: 없음
- 기기 내 처리: 위치, 사진, 방문, 리뷰, 태그, XP
- 위치 접근: 사용자가 현재 위치 확인을 실행한 동안만
- 카메라 접근: 사용자가 방문 사진을 추가할 때만
- 백그라운드 위치: 없음
- Android 자동 백업·기기 이전: 비활성화
- JSON 백업: 좌표·사진을 포함할 수 있고 별도 암호화되지 않음
- 민감 데이터 콘솔 로깅: 비활성화

## 알려진 조건과 남은 절차

1. 최신 Android System WebView 또는 Chrome을 권장합니다. WebView 124·134에서는 정상이고 오래된 AOSP WebView 95에서는 최신 스타일 일부가 잘못 렌더링됐습니다.
2. 기능 검증용 더미 POI 100건은 공개 출시 전에 출처·좌표·라이선스가 확인된 실제 데이터로 교체해야 합니다.
3. Play Console에서 AAB, 정책 선언, 등록정보와 이미지를 제출하고 실제 테스터를 운영해야 합니다.
4. 계정에 요건이 적용되면 최소 12명이 14일 연속 옵트인한 뒤 프로덕션 액세스를 신청합니다.
5. Windows에서는 iOS 빌드·서명·Simulator 테스트가 불가능하므로 macOS와 Xcode에서 최종 검증합니다.

## 비차단 빌드 경고

- Gradle flatDir 저장소는 메타데이터 형식 지원이 제한된다는 경고가 있습니다.
- 일부 플러그인이 Gradle 9에서 제거될 deprecated 기능을 사용합니다.

현재 Android 0.2.0 빌드와 테스트에는 영향을 주지 않았지만 후속 Capacitor·Gradle 업그레이드에서 정리합니다.
