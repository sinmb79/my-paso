# Android 0.2.0-alpha4 다음 출시 보완 보고서

- 기준일: 2026-07-30
- 앱: Hello! My Paso!
- 패키지: `com.mypaso.app`
- 후보 버전: 0.2.0 (`versionCode 5`)
- Play 출시명: `0.2.0-alpha4`

## 결론

Play Console의 “다음 출시 버전을 위한 발견 항목” 2건을 확인하고 Android 15·16의 edge-to-edge 동작과 카메라 플러그인의 시스템 바 API 사용을 보완했습니다. API 35와 API 36 전용 에뮬레이터에서 지도, 저널, 카메라 사진 선택 하단 시트를 다시 검증했으며 시스템 바 침범, 네이티브 액션바 회귀, 앱 크래시는 발견되지 않았습니다.

이 보고서의 AAB는 2026-07-30 Play Console 비공개 테스트 Alpha의 `0.2.0-alpha4` 초안에 업로드하고 저장했습니다. 검토 제출과 테스터 대상 출시는 아직 실행하지 않았습니다. Google의 새 번들 분석이 끝나야 기존 발견 항목이 실제로 해제됐는지 최종 확인할 수 있습니다.

## Play Console 확인 결과

### 발견 항목 1

`일부 사용자에게는 더 넓은 화면이 표시되지 않을 수 있습니다`

조치:

- `MainActivity`에서 `EdgeToEdge.enable(this)`를 Capacitor 브리지 초기화 전에 호출
- 시작 테마가 다시 액션바를 만들지 않도록 `AppTheme.NoActionBar`를 먼저 적용
- 입력창에서 키보드가 열릴 때 콘텐츠가 가려지지 않도록 `adjustResize` 유지
- Capacitor Android/Core를 8.4.2로 갱신해 최신 시스템 바·안전 영역 처리를 사용

### 발견 항목 2

`앱에서 더 넓은 화면용으로 지원 중단된 API 또는 파라미터를 사용합니다`

Play가 표시한 API:

- `android.view.Window.setStatusBarColor`
- `android.view.Window.setNavigationBarColor`

Play가 표시한 시작 위치:

- `com.google.android.material.bottomsheet.BottomSheetDialog.onCreate`
- `com.google.android.material.internal.EdgeToEdgeUtils.applyEdgeToEdge`
- `com.google.android.material.sidesheet.SheetDialog.onCreate`

원인과 조치:

- 직접 작성한 앱 코드가 아니라 `@capacitor/camera`가 가져온 Material Components 1.13.0 경로였습니다.
- `@capacitor/camera`를 8.2.1로, Material Components를 1.14.0으로 갱신했습니다.
- Gradle `releaseRuntimeClasspath`에서 실제 선택 버전이 `com.google.android.material:material:1.14.0`임을 확인했습니다.
- Material 1.14.0은 Android 15 이상에서 해당 시스템 바 색상 API를 호출하지 않도록 보호 조건을 둡니다.

### 사전 출시 보고서

Play Console의 사전 출시 보고서 개요·세부정보 화면에는 이번 확인 시점에 조치 가능한 결과가 표시되지 않았습니다. 이는 “검사 통과” 판정이 아니라, 표시된 보고 결과가 없었다는 뜻입니다.

## 기기 검증

### Android 15 / API 35

- AVD: `Moonbanggu_ClosedTest_API35`
- 화면: 1080 × 2400
- 내비게이션: 3버튼
- WebView 안전 영역: `[0,63][1080,2274]`
- 네이티브 액션바: 없음
- 카메라 하단 시트: `[0,1867][1080,2274]`
- 앱 FATAL 로그: 0건

증거:

- `phone-api35-edge-to-edge-map.png`
- `phone-api35-camera-bottomsheet.png`

### Android 16 / API 36

- AVD: `Medium_Phone_API_36.1`
- 화면: 1080 × 2400
- 내비게이션: 제스처
- WebView 안전 영역: `[0,63][1080,2337]`
- 네이티브 액션바: 없음
- 카메라 하단 시트: `[0,1930][1080,2337]`
- 앱 FATAL 로그: 0건

증거:

- `phone-api36-edge-to-edge-map.png`
- `phone-api36-camera-bottomsheet.png`

## 의존성 보완

- `@capacitor/android`, `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`: 8.4.2
- `@capacitor/camera`: 8.2.1
- Material Components: 1.14.0
- Next.js 및 `eslint-config-next`: 16.2.12
- Sharp: 0.35.3 강제 해석
- Gradle Wrapper: 8.14.5
- 배포 의존성 감사: `npm audit --omit=dev` 취약점 0건

전체 `npm audit`에는 ESLint 플러그인들이 아직 사용하는 구형 `minimatch`/`brace-expansion` 경로의 개발 전용 경고가 남습니다. 이 경로는 정적 웹 산출물이나 AAB에 포함되지 않으며, 호환되지 않는 강제 메이저 교체는 적용하지 않았습니다.

## Android Lint 및 리소스 보완

첫 검사에서 오류 0건, 경고 18건이 확인됐습니다.

- Gradle Wrapper를 8.14.5로 올려 패치 버전 경고 제거
- 사용하지 않는 Capacitor 템플릿 레이아웃·배경·문자열 제거
- API 24와 중복되던 `drawable-v24` 리소스를 테마형 런처 아이콘용 단색 벡터로 교체
- 일반·원형 adaptive icon 모두에 `monochrome` 리소스 추가
- Capacitor가 런타임에 이름으로 읽는 `config.xml`과 브랜드용 레거시 아이콘·전체 화면 스플래시 리소스만 경로 단위로 근거를 적어 제외
- 앱이 소유한 Gradle 폐기 예정 문법 수정

최종 `lintRelease` 결과는 `No issues found`이며 Gradle 폐기 예정 API 경고도 0건입니다. 빌드 시 표시되는 `flatDir` 안내 2건은 Capacitor가 Cordova 로컬 AAR 호환을 위해 생성하는 저장소 선언입니다. 현재 해당 로컬 AAR 디렉터리와 배포 파일은 없으며, 생성 파일을 임의 수정하지 않고 후속 Capacitor 업데이트에서 다시 확인합니다.

## 자동 검증

- Vitest: 24개 파일, 68개 테스트 통과
- ESLint: 통과
- Next.js 정적 프로덕션 빌드: 통과
- `npm audit --omit=dev`: 취약점 0건
- Android `testDebugUnitTest`: 통과
- Android `lintRelease`: `No issues found`
- Gradle `releaseRuntimeClasspath`: Material Components 1.14.0 선택 확인
- API 35·36 에뮬레이터 앱 FATAL 로그: 각 0건

## 서명 AAB

- 파일: `android/app/build/outputs/bundle/release/app-release.aab`
- 패키지: `com.mypaso.app`
- 버전: `0.2.0` (`versionCode 5`)
- SDK: min 24 / target 36
- 크기: 7,893,340 bytes
- SHA-256: `445E51A2D4FC07CE9DC5A860FDE91AA8B07AAB03FC60FAAAA78AC8EB85D5A5B9`
- 업로드 인증서 SHA-256: `F5:F4:5C:6F:14:37:07:BC:A9:E6:18:02:EE:AB:9E:FA:92:1C:66:23:F1:30:90:6F:90:5A:6A:0B:7B:64:11:BC`
- `bundletool validate`: 통과
- `jarsigner -verify`: 통과

## Play 배포 상태

- 현재 게시 중인 Alpha: `0.2.0-alpha3`, `versionCode 4`, 100%
- 저장된 출시 초안: `0.2.0-alpha4`, `versionCode 5`, target SDK 36
- 업로드 파일: `app-release.aab`
- 한국어·영어 출시 노트: 2개 중 2개 언어 입력 및 저장
- 검토 제출·출시 시작: 미실행
- 현재 Alpha에서 사용 가능 사용자 수가 0명으로 표시되어 실제 테스터 옵트인 모집은 별도로 진행해야 함
- 계정에 개인 개발자 테스트 요건이 적용되면 최소 12명이 14일 연속 옵트인해야 함
- Play의 발견 항목·사전 출시 보고서 재분석 결과 확인 필요
