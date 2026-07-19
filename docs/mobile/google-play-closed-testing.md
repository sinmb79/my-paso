# Google Play 비공개 테스트 실행 가이드

기준일: 2026-07-19
앱 ID: com.mypaso.app
배포 후보: 0.2.0 (versionCode 3)
출시명: 0.2.0-alpha2

## 공식 요건 확인

2023년 11월 13일 이후 생성된 개인 개발자 계정에서 Play Console이 프로덕션 액세스 테스트를 요구하면, 최소 12명의 테스터가 비공개 테스트에 14일 연속 옵트인해야 합니다. 계정별 실제 적용 여부와 진행 상태는 Play Console 대시보드가 최종 기준입니다.

- 권장 모집 인원: 15~20명
- 운영 트랙: 비공개 테스트
- 유지 조건: 최소 12명이 14일 연속 옵트인
- 품질 조건: 핵심 기능을 실제 사용하고 피드백·수정 증거를 보존

공식 자료:

- [개인 개발자 계정 앱 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=ko)
- [데이터 보안 양식](https://support.google.com/googleplay/android-developer/answer/10787469?hl=ko)
- [스토어 미리보기 에셋 요건](https://support.google.com/googleplay/android-developer/answer/9866151?hl=ko)
- [개인정보처리방침 요건](https://support.google.com/googleplay/android-developer/answer/17105854?hl=ko)

## 1. 검증된 업로드 파일

PowerShell에서 다시 만들 때:

    npm run android:bundle:release

생성 위치:

    android/app/build/outputs/bundle/release/app-release.aab

현재 검증값:

| 항목 | 값 |
|---|---|
| versionName | 0.2.0 |
| versionCode | 3 |
| AAB 크기 | 7,017,483 bytes |
| AAB SHA-256 | 14B16AA0514083B9698D8F3E3163EC34D0F17178D08C99DD82188B7C01631BA6 |
| 패키지 | com.mypaso.app |
| 최소·대상 SDK | API 24 / API 36 |
| Bundletool validate | 통과 |
| 업로드 인증서 SHA-256 | F5:F4:5C:6F:14:37:07:BC:A9:E6:18:02:EE:AB:9E:FA:92:1C:66:23:F1:30:90:6F:90:5A:6A:0B:7B:64:11:BC |

업로드 키와 암호는 저장소에 넣지 않습니다.

    C:\Users\sinmb\key\my-paso-upload.keystore
    C:\Users\sinmb\key\my-paso-upload.properties

다음 업데이트는 Play가 사용한 versionCode를 재사용할 수 없으므로 4 이상으로 증가시킵니다.

## 2. 앱 콘텐츠와 데이터 보안

| Play Console 항목 | 0.2.0 답변 |
|---|---|
| 앱 액세스 권한 | 로그인 없음, 모든 기능 제한 없이 사용 가능 |
| 광고 | 없음 |
| 타겟층 | 비공개 테스트는 만 18세 이상 |
| 데이터 보안 | 개발자·제3자 서버로 수집 또는 공유 없음 |
| 계정 삭제 | 계정 기능 없음 |
| 정부·금융·건강 앱 | 해당 없음 |
| 카테고리 | 라이프스타일 |
| 개발자 이메일 | sinmb82@gmail.com |
| 개인정보처리방침 | https://sinmb79.github.io/my-paso/privacy.html |

앱은 포그라운드 위치와 카메라 권한을 요청할 수 있습니다. 위치는 사용자가 현재 위치 확인을 누를 때, 카메라는 사진 추가를 누를 때만 사용합니다. 위치·사진·방문 기록은 외부 서버로 전송하지 않고 앱 전용 저장소에 보관합니다. 백그라운드 위치 권한은 없습니다.

JSON 백업은 사용자가 직접 요청한 내보내기입니다. 좌표, 사진, 태그가 포함될 수 있고 별도 암호화되지 않으므로 개인정보처리방침과 앱 안내를 그대로 유지합니다.

## 3. 스토어 등록정보

store-assets/store-listing.txt의 국문을 기본 등록정보에 입력하고 English listing을 별도 영어 번역 등록정보로 추가합니다.

업로드 파일:

- 앱 아이콘: docs/mobile/store-assets/icon-512.png
- 그래픽 이미지: docs/mobile/store-assets/feature-graphic.png
- 휴대전화: screenshot-01-map.png부터 screenshot-04-profile.png
- 태블릿: screenshot-05-tablet-landscape.png

스크린샷은 실제 에뮬레이터 앱 화면입니다. 현재 100개 장소는 기능 검증용 더미 데이터이므로 공개 출시 전에 실제 데이터로 다시 촬영합니다.

## 4. 비공개 테스트 버전 생성

1. Play Console의 테스트 및 출시에서 비공개 테스트 Alpha 트랙을 엽니다.
2. 대한민국을 대상 국가로 확인합니다.
3. 새 버전에 app-release.aab를 업로드합니다.
4. 출시명을 0.2.0-alpha2로 입력합니다.
5. closed-test/release-notes-ko.txt와 release-notes-en.txt의 내용을 각 언어 태그에 입력합니다.
6. 권한·데이터 보안 경고가 실제 앱 동작과 일치하는지 확인합니다.
7. 저장 후 검토를 시작하고 비공개 테스트 출시를 게시합니다.

Play App Signing의 앱 서명 키와 로컬 업로드 키는 서로 다른 역할입니다. 로컬 업로드 키와 속성 파일은 암호화된 별도 저장소에도 백업합니다.

## 5. 테스터 운영

1. Alpha Testers 목록에 15명 이상을 등록합니다.
2. Play Console이 표시하는 실제 옵트인 링크를 공유합니다.
3. 초대 계정으로 옵트인한 뒤 Play Store 설치 링크를 열게 합니다.
4. tester-guide-ko.txt와 test-missions.md를 함께 전달합니다.
5. feedback-log.csv에 참여일, 기기, Android·WebView 버전, 수행 미션, 문제와 조치를 기록합니다.

일반적인 옵트인 주소 형식은 아래와 같지만, 콘솔의 실제 주소를 우선합니다.

    https://play.google.com/apps/testing/com.mypaso.app

## 6. 14일 운영표

| 날짜 | 수행 작업 | 남길 증거 |
|---|---|---|
| D0 | 15명 이상 옵트인·설치 확인 | 테스터 목록과 참여일 |
| D1~D3 | 지도·탐색·저장·태그·검색 | 기기·OS·WebView·결과 |
| D4~D6 | GPS/수동 방문·사진·리뷰 | 권한 흐름과 피드백 |
| D7~D9 | 강제 종료 후 기록 유지 | 영속성 결과 |
| D10~D11 | JSON 내보내기·초기화·복원 | 파일과 복원 결과 |
| D12~D13 | 결함 수정판 회귀 검증 | 버전과 변경 내역 |
| D14 이후 | 12명 연속 옵트인 확인 | 최종 운영 요약 |

테스터가 매일 앱을 열어야 한다는 명시 요건은 아니지만, 프로덕션 액세스 신청에서는 참여도와 피드백을 설명해야 합니다. 각 테스터가 최소 3개 미션을 수행하도록 운영합니다.

## 7. 프로덕션 액세스 신청

- 모집 경로와 테스터 구성
- 14일 연속 옵트인 인원
- 실제 사용한 기능과 사용 패턴
- 피드백 수집 방식과 대표 의견
- 발견한 결함, 수정 버전과 회귀 결과
- 타겟 사용자와 앱의 가치
- 공개 출시가 가능하다고 판단한 증거

공개 신청 전에는 더미 POI 100건을 출처·좌표·라이선스가 검증된 실제 POI로 교체하고 새 AAB, 설명, 스크린샷을 다시 검증합니다.

## 알려진 환경 조건

- 최신 Android System WebView 또는 Chrome을 권장합니다.
- AOSP 에뮬레이터에 공유 가능한 앱이 없으면 공유 시트가 대상을 찾지 못할 수 있지만 Documents에 백업 파일은 생성됩니다.
- iOS 빌드·서명·시뮬레이터 테스트는 macOS와 Xcode에서 별도로 수행합니다.
