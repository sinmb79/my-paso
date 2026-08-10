# Google Play 비공개 테스트 실행 가이드

기준일: 2026-08-11
앱 ID: com.mypaso.app
현재 게시 버전: 0.2.0 (versionCode 4)
현재 출시명: 0.2.0-alpha3
검토 중 업데이트: 0.2.0 (versionCode 5, 2026-07-30 제출)
검토 중 출시명: 0.2.0-alpha4
다음 후보: 0.3.0 (versionCode 6 예정, 업로드 전 Console에서 미사용 여부 재확인)

## 공식 요건 확인

2023년 11월 13일 이후 생성된 개인 개발자 계정에서 Play Console이 프로덕션 액세스 테스트를 요구하면, 최소 12명의 테스터가 비공개 테스트에 14일 연속 옵트인해야 합니다. 계정별 실제 적용 여부와 진행 상태는 Play Console 대시보드가 최종 기준입니다.

- 권장 모집 인원: 15~20명
- 운영 트랙: 비공개 테스트
- 유지 조건: 최소 12명이 14일 연속 옵트인
- 품질 조건: 핵심 기능을 실제 사용하고 피드백·수정 증거를 보존

공식 자료:

- [개인 개발자 계정 앱 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=ko)
- [데이터 보안 양식](https://support.google.com/googleplay/android-developer/answer/10787469?hl=ko)
- [사용자 데이터 정책](https://support.google.com/googleplay/android-developer/answer/10144311)
- [명확한 공개와 동의 권장사항](https://support.google.com/googleplay/android-developer/answer/11150561)
- [스토어 미리보기 에셋 요건](https://support.google.com/googleplay/android-developer/answer/9866151?hl=ko)
- [Google Play 개발자 프로그램 정책](https://support.google.com/googleplay/android-developer/answer/17190352)

## 1. 검증된 업로드 파일

PowerShell에서 다시 만들 때:

    npm run android:bundle:release

생성 위치:

    android/app/build/outputs/bundle/release/app-release.aab

과거 alpha2/versionCode 3 검증값:

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

다음 업데이트는 Play가 사용한 versionCode를 재사용할 수 없습니다. versionCode 5가 이미 제출됐으므로 0.3.0 후보는 Console에서 미사용을 재확인한 versionCode 6을 사용합니다.

실제 POI 교체판은 versionCode 4로 빌드·서명됐고 현재 Alpha에 게시됐습니다.

| 항목 | versionCode 4 현재 게시본 |
|---|---|
| AAB 크기 | 7,019,128 bytes |
| AAB SHA-256 | FEE02729F0029B3778351662A653C8B428F70F68897AA771E136580CAA7E8A71 |
| APK 크기 | 7,747,701 bytes |
| APK SHA-256 | 8B329E9AEE745890831299CD2DB323AC701CA99F2FAF0F8A76B757199AC91290 |
| Bundletool validate | 통과 |
| AAB 내부 데이터 | Wikidata QID 100개, 더미 ID 0개 |

2026-07-30 제출된 alpha4/versionCode 5:

| 항목 | versionCode 5 제출본 |
|---|---|
| 출시명 | 0.2.0-alpha4 |
| AAB 크기 | 7,893,340 bytes |
| AAB SHA-256 | 445E51A2D4FC07CE9DC5A860FDE91AA8B07AAB03FC60FAAAA78AC8EB85D5A5B9 |
| target SDK | API 36 |
| Bundletool / jarsigner | 통과 |
| Play 상태 | 검토 중인 변경사항, 승인 후 자동 출시 |

## 2. 앱 콘텐츠와 데이터 보안

0.3.0은 선택적 로컬 AI를 추가합니다. localhost는 같은 기기 안의 loopback이지만, 사설망 주소로 보내는 선택한 장소 이름·메모와 EXIF 제거 임시 사진은 기기 밖 전송이므로 Play Data safety의 수집 범위에 포함합니다.

| Play Console 항목 | 0.3.0 작업 답변 |
|---|---|
| 앱 액세스 권한 | 로그인 없음, 모든 기능 제한 없이 사용 가능 |
| 광고 | 없음 |
| 타겟층 | 비공개 테스트는 만 18세 이상 |
| 데이터 수집 | 사설망 AI 모드에서 `Yes`; `Photos`, `Other user-generated content`, 선택 사항, 앱 기능 |
| 데이터 공유 | 소유자 관리 엔드포인트로 사용자가 직접 보내는 현재 전제에서는 `No` 후보. 제출 직전 실제 엔드포인트 운영·법적 소유 흐름에 따라 재확인 |
| 전송 중 암호화 | 기기 밖 수집은 HTTPS 사설망과 플랫폼 TLS만 사용하므로 `Yes`; HTTP localhost는 기기 안 처리 |
| 계정 삭제 | 계정 기능 없음 |
| 정부·금융·건강 앱 | 해당 없음 |
| 카테고리 | 라이프스타일 |
| 개발자 이메일 | sinmb82@gmail.com |
| 개인정보처리방침 | https://sinmb79.github.io/my-paso/privacy.html |

앱은 포그라운드 위치와 카메라 권한을 요청할 수 있습니다. 위치는 사용자가 현재 위치 확인을 누를 때, 카메라는 사진 추가를 누를 때만 사용하며 백그라운드 위치 권한은 없습니다. 정확한 위치와 EXIF·사진 메타데이터는 AI 요청에 포함하지 않습니다.

AI는 선택 사항입니다. 앱은 HTTP/HTTPS localhost·loopback 또는 사용자가 정확히 확인한 HTTPS 사설망 IPv4만 허용하며, HTTP 사설망과 공개·클라우드·개발자 운영 엔드포인트는 차단합니다. 전송 미리보기와 명시적 확인 뒤에만 선택한 장소 이름·메모, 비전 모델에서는 EXIF를 제거한 임시 사진 복사본을 보냅니다. HTTPS 사설망 운영자는 이를 처리할 수 있고 기기 밖 전송은 플랫폼 TLS로 암호화됩니다. HTTP localhost는 기기 안에서 처리됩니다. 개발자는 AI 엔드포인트를 운영하거나 요청을 수신·보관·열람하지 않습니다. AI 결과는 초안이며 자동 저장·동기화·공유하지 않습니다. 모델 가중치는 앱에 포함하지 않습니다.

JSON 백업은 사용자가 직접 요청한 내보내기입니다. 좌표, 사진, 태그가 포함될 수 있고 별도 암호화되지 않으므로 개인정보처리방침과 앱 안내를 그대로 유지합니다.

Console 입력 전에는 [0.3.0 Data Safety 작업표](./data-safety-0.3.0.md)를 한 항목씩 대조합니다. 특히 공유 여부는 실제 엔드포인트 소유·운영 관계를 기준으로 재확인하고, 기기 밖 수집 경로가 HTTPS 사설망으로만 제한되는지 검증한 뒤 전송 중 암호화를 `Yes`로 답합니다.

## 3. 스토어 등록정보

store-assets/store-listing.txt의 국문을 기본 등록정보에 입력하고 English listing을 별도 영어 번역 등록정보로 추가합니다.

업로드 파일:

- 앱 아이콘: docs/mobile/store-assets/icon-512.png
- 그래픽 이미지: docs/mobile/store-assets/feature-graphic.png
- 휴대전화: screenshot-01-map.png부터 screenshot-04-profile.png
- 태블릿: screenshot-05-tablet-landscape.png

스크린샷은 실제 에뮬레이터 앱 화면입니다. 2026-07-19에 API 35 휴대전화와 API 36 태블릿에서 Wikidata CC0 기반 실제 장소 100건으로 모두 다시 촬영했습니다.

## 4. 비공개 테스트 버전 업데이트

0.2.0-alpha3 versionCode 4는 현재 Alpha에 100% 게시됐습니다. Android 15·16 보완판인 0.2.0-alpha4 versionCode 5는 2026-07-30 같은 Alpha 트랙에 제출됐고 현재 `검토 중인 변경사항` 상태입니다. 관리형 게시를 사용하지 않으므로 승인되면 자동 출시됩니다.

1. 완료: Play Console의 비공개 테스트 Alpha 트랙과 대한민국 대상 국가 1개를 확인했습니다.
2. 완료: versionCode 5 `app-release.aab`를 업로드했습니다.
3. 완료: 출시명을 `0.2.0-alpha4`로 지정했습니다.
4. 완료: `closed-test/release-notes-ko.txt`와 `release-notes-en.txt`를 입력하고 2개 언어 제공을 확인했습니다.
5. 완료: 자동 검사를 통과하고 권한·데이터 보안과 기기 지원 변화를 검토했습니다.
6. 완료: 100% 출시 변경사항 1건을 Google 검토에 전송했습니다.
7. 남음: versionCode 5 검토 승인 후 Alpha 자동 게시와 테스터 배포 상태를 확인합니다.

### 0.3.0 업데이트 체크

1. Console에서 versionCode 6이 미사용인지 확인합니다.
2. 개인정보처리방침 URL이 0.3.0의 HTTP localhost·HTTPS 사설망 경계와 HTTP 사설망 차단을 표시하는지 확인합니다.
3. Data safety에서 `Photos`와 `Other user-generated content`의 선택적 수집·앱 기능 목적을 입력합니다.
4. 실제 엔드포인트 운영 관계로 공유 여부를 다시 판단하고, HTTPS 사설망만 기기 밖 수집에 쓰이는 검증 증거로 전송 중 암호화를 `Yes`로 답합니다.
5. 0.3.0 AAB와 국·영문 릴리스 노트를 업로드한 뒤 차단 오류가 없는지 확인합니다.
6. 기존 테스터 그룹·국가·출시 비율을 유지하고 검토 제출 상태를 증거 보고서에 기록합니다.

Play App Signing의 앱 서명 키와 로컬 업로드 키는 서로 다른 역할입니다. 로컬 업로드 키와 속성 파일은 암호화된 별도 저장소에도 백업합니다.

## 5. 테스터 운영

1. Alpha Testers의 `젤리테스터` 이메일 목록 44명을 유지합니다.
2. Play Console이 표시하는 실제 옵트인 링크를 공유합니다.
3. 초대 계정으로 옵트인한 뒤 Play Store 설치 링크를 열게 합니다.
4. tester-guide-ko.txt와 test-missions.md를 함께 전달합니다.
5. feedback-log.csv에 참여일, 기기, Android·WebView 버전, 수행 미션, 문제와 조치를 기록합니다.

일반적인 옵트인 주소 형식은 아래와 같지만, 콘솔의 실제 주소를 우선합니다.

    https://play.google.com/apps/testing/com.mypaso.app

이전 2026-07-19 대시보드에는 `12명 이상의 테스터가 옵트인함`이 표시됐지만, 더 최신인 2026-07-30 alpha4 제출 증거에는 현재 Alpha에서 사용 가능 사용자 수가 0명으로 표시됐습니다. Console에서 실제 초대 목록·옵트인·사용 가능 사용자를 다시 확인하고, 최소 12명의 14일 연속 참여를 새 증거로 기록합니다.

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

더미 POI 100건의 교체, CC0 출처 매니페스트, 새 AAB, 설명과 스크린샷 재검증은 versionCode 4에서 완료했습니다. 프로덕션 신청 전에는 운영·폐업과 출입구 수준 좌표가 중요한 POI를 사람 검수하고, Play 대시보드의 14일 연속 조건을 최종 확인합니다.

## 알려진 환경 조건

- 최신 Android System WebView 또는 Chrome을 권장합니다.
- AOSP 에뮬레이터에 공유 가능한 앱이 없으면 공유 시트가 대상을 찾지 못할 수 있지만 Documents에 백업 파일은 생성됩니다.
- iOS 빌드·서명·시뮬레이터 테스트는 macOS와 Xcode에서 별도로 수행합니다.
