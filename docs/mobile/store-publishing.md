# 모바일 스토어 배포 현황

기준일: 2026-08-11

## Android 비공개 테스트 현황

| 항목 | 상태 | 위치 또는 기준 |
|---|---|---|
| 패키지 ID | 준비 | com.mypaso.app |
| 현재 게시 버전 | Alpha 게시 | 0.2.0-alpha4 / versionCode 5 |
| 현재 출시명 | Alpha 활성 | 0.2.0-alpha4 |
| 검토 중 업데이트 | 2026-08-11 제출·빠른 검사 실행 중 | 0.3.0 / versionCode 6 |
| 검토 중 출시명 | Alpha 제출 완료 | 0.3.0-alpha1 |
| 0.3.0 후보 | 제출 완료·Google 검토 중 | versionCode 6, `검토 중인 변경사항` |
| 최소·대상 SDK | 준비 | API 24 / API 36 |
| App Bundle | v6 서명·검증·Play 업로드 완료 | 8,277,246 bytes, SHA-256 `F4F386B760F3A71F4D8BF2DDE89528B41CF93713811C475C77EC832C17584679` |
| 릴리스 APK | v6 서명·업데이트 설치 검증 완료 | android/app/build/outputs/apk/release/app-release.apk |
| 업로드 키 | 저장소 밖으로 분리 | C:\Users\sinmb\key |
| 런타임 권한 | 최소화 | 포그라운드 위치, 카메라 |
| 백그라운드 위치 | 미요청 | AndroidManifest 확인 |
| Android 자동 백업 | 차단 | 클라우드 백업·기기 이전 제외 |
| 개인정보처리방침 | 국문·영문 준비 | public/privacy.html |
| 스토어 등록정보 | 국문·영문 준비 | store-assets/store-listing.txt |
| 이미지 | 실제 앱 화면으로 준비 | store-assets 폴더 |
| 테스트 운영 자료 | 준비 | closed-test 폴더 |
| Play Console alpha4 | 게시 완료 | 0.2.0-alpha4, versionCode 5, Alpha 활성 |
| Play Console 0.3.0-alpha1 | 검토 중 | versionCode 6, 2026-08-11 제출, `검토 중인 변경사항` |
| Play 배포 추정 | 확인 완료 | 신규 설치 7.44 MB, 업데이트 5.98 MB, 지원 기기 변화 0 |
| Play 경고 | 비차단 | R8/Proguard mapping 부재, native debug symbols 부재 |

## 제출된 v5 검증 — 2026-07-30

- 출시명: `0.2.0-alpha4`, versionCode 5, target SDK 36
- AAB SHA-256: `445E51A2D4FC07CE9DC5A860FDE91AA8B07AAB03FC60FAAAA78AC8EB85D5A5B9`
- AAB 크기: 7,893,340 bytes
- Bundletool 구조 검증과 jarsigner 서명 검증: 통과
- Android `testDebugUnitTest`, `lintRelease`(`No issues found`), API 35·36 에뮬레이터 확인: 통과
- Play 상태: 비공개 테스트 Alpha 100%, `검토 중인 변경사항`, 승인 후 자동 출시
- Source of truth: `closed-test/evidence/report-0.2.0-alpha4.md`

## 현재 게시 v4의 역사 로컬 검증

- AAB SHA-256: FEE02729F0029B3778351662A653C8B428F70F68897AA771E136580CAA7E8A71
- AAB 크기: 7,019,128 bytes
- Bundletool 구조 검증, 업로드 인증서 일치: 통과
- 릴리스 APK SHA-256: 8B329E9AEE745890831299CD2DB323AC701CA99F2FAF0F8A76B757199AC91290
- APK v2 서명 및 업로드 인증서 일치: 통과
- 휴대전화 API 35와 태블릿 API 36에서 기존 versionCode 2 위 versionCode 4 업데이트 설치·콜드 스타트: 통과
- 지도, 탐색, 저장 장소, 태그, 상세 화면, 방문, 사진, 저널, 프로필: 통과
- 앱 강제 종료·업데이트 설치 후 로컬 기록 유지: 통과
- 앱 데이터 초기화 후 JSON 전체 복원: 통과
- 테스트 파일 24개, 테스트 63개, ESLint, 웹·모바일 빌드, Android·iOS Capacitor 동기화: 통과
- npm audit: 취약점 0건
- AAB 번들 데이터: Wikidata QID 100개, 더미 ID·테스트 장소명 0개
- 실제 POI 스크린샷: 휴대전화 1080 x 2400 네 장, 태블릿 2560 x 1600 한 장 재촬영 완료
- Play 지원 기기 변화: 전화·태블릿을 포함한 모든 폼 팩터에서 제외 0대
- Play 검증 경고: 난독화를 사용하지 않는 빌드의 가독화 파일 부재 1건(비차단)

현재 게시된 v4의 세부 명령, 기기 프로필, 해시와 화면 증거는 closed-test/evidence/report-0.2.0-alpha3.md에 기록했습니다. 2026-07-30 제출된 v5의 서명 AAB, 해시, Android 15·16 검증과 Play 상태는 closed-test/evidence/report-0.2.0-alpha4.md가 source of truth입니다. report-0.2.0.md는 이전 출시의 역사 기록입니다.

## Play Console 데이터 보안 기준

0.3.0-alpha1 제출본은 AI를 사용하지 않을 때 모든 기록이 앱 전용 저장소에 남지만, 사용자가 사설망 AI를 켜고 미리보기 뒤 명시적으로 보내면 선택한 장소 이름·메모와 EXIF를 제거한 임시 사진 복사본이 기기 밖 엔드포인트로 이동합니다. Google Play의 Data safety 정의에서는 앱에서 기기 밖으로 전송되는 데이터를 `수집(collect)`으로 봅니다.

- AI: 선택 사항. AI를 끄거나 설정하지 않아도 앱을 사용 가능
- 허용 엔드포인트: HTTP/HTTPS localhost·loopback 또는 사용자가 정확히 확인한 HTTPS 사설망 IPv4
- 차단 엔드포인트: HTTP 사설망, 공개 인터넷, 클라우드 및 개발자 운영 주소
- 전송 전 통제: 전송 미리보기와 별도 명시적 확인
- 수집 데이터 유형: `Photos`, `Other user-generated content`(선택한 장소 이름·메모)
- 수집 여부: 사설망 모드에서 `Yes`, 선택 사항, 목적은 앱 기능
- 공유 여부: 소유자가 관리하는 엔드포인트로 사용자가 직접 전송하는 현재 제출 흐름에서 `No`
- 전송 중 암호화: 기기 밖 수집은 HTTPS 사설망으로만 가능하고 플랫폼 TLS를 사용하므로 `Yes`. HTTP localhost는 기기 안 처리라 수집 대상이 아님
- AI 요청에서 제외: 정확한 위치, EXIF·사진 메타데이터, 다른 기록, 백업, API 키
- AI 결과: 편집 가능한 초안만 반환하며 자동 저장·동기화·공유하지 않음
- 개발자 처리: AI 엔드포인트를 운영하지 않고 요청을 수신·보관·열람하지 않음
- 모델: 가중치를 앱에 포함하지 않으며 소유자가 호환 실행기를 별도 준비
- 광고, 행동 추적, 원격 분석, 계정: 없음
- Android 자동 클라우드 백업과 기기 이전: 비활성화
- 사용자가 직접 내보낸 JSON: 좌표, 태그, 방문 기록, 사진을 포함할 수 있으며 별도 암호화되지 않음
- 삭제: 앱 데이터 삭제 또는 앱 제거; 사용자가 운영하는 AI 실행기의 로그·보관 정책은 그 운영자가 관리

작성 근거와 Console 입력 체크리스트는 [data-safety-0.3.0.md](./data-safety-0.3.0.md)를 사용합니다. 이는 법률 자문이 아니라 현재 앱 동작을 사실대로 옮기기 위한 작업표이며, 실제 제출 화면과 최신 정책이 최종 기준입니다.

## Play Console 제출 현황

1. 완료: 0.2.0 (versionCode 5, `0.2.0-alpha4`)이 비공개 테스트 Alpha의 현재 게시 버전입니다.
2. 완료: 권한, 데이터 보안, 앱 액세스, 콘텐츠 등급과 타겟층 답변을 확인했습니다.
3. 완료: 국문·영문 등록정보와 아이콘, 그래픽, 휴대전화·태블릿 스크린샷을 등록했습니다.
4. 완료: 0.2.0-alpha2 100% 출시안과 등록정보 변경 3건을 Google 검토에 제출했습니다.
5. 완료: Google 승인 후 0.2.0-alpha2 Alpha 트랙 자동 게시와 활성 상태를 확인했습니다.
6. 완료: Play 대시보드에서 12명 이상 옵트인 조건을 확인했습니다. `젤리테스터` 이메일 목록은 44명입니다.
7. 완료: versionCode 4 실제 POI 업데이트 `0.2.0-alpha3`은 역사 Alpha 릴리스로 보존되며, 현재 Alpha 게시 버전은 versionCode 5 `0.2.0-alpha4`입니다.
8. 완료: 2026-08-11 versionCode 6 `0.3.0-alpha1`을 Alpha에 전송했습니다. Alpha, 국·영문 등록정보, 휴대전화·7인치·10인치 스크린샷, 개인정보처리방침 URL과 Data safety를 포함한 13개 변경사항이 `검토 중인 변경사항`에 있습니다.
9. 완료: 새 휴대전화 4장과 수정된 태블릿 스크린샷은 AI-generated/modified로 라벨했습니다. 기존 아이콘·feature graphic·이전 스크린샷에는 라벨을 붙이지 않았습니다.
10. 남음: `0.3.0-alpha1`의 빠른 검사와 Google 검토 결과를 확인합니다.
11. 남음: Console에서 현재 사용 가능 사용자와 옵트인을 다시 확인하고 최소 12명의 14일 연속 참여 및 미션·피드백 증거를 기록합니다.
12. 남음: 연속 기간 충족 후 프로덕션 액세스를 신청합니다.

## 공개 출시 전 필수 게이트

1. 완료: 더미 POI 100건을 Wikidata CC0 기반 대한민국 실제 장소 100건으로 교체하고 출처 매니페스트·해시를 고정했습니다.
2. 완료: 새 시드로 국영문 설명과 휴대전화·태블릿 스크린샷을 다시 검수했습니다.
3. 남음: 운영·폐업과 출입구 수준 좌표가 중요한 POI를 사람 검수합니다.
4. 남음: 비공개 테스트의 P0·P1 결함을 모두 닫고 회귀 증거를 남깁니다.
5. 남음: Play Console이 표시하는 14일 연속 기간을 충족합니다.
6. 남음: 최신 Android System WebView 또는 Chrome이 설치된 대표 물리 실기기에서 한 번 더 확인합니다.

## 호환성과 iOS

Android 최소 버전은 API 24이지만 최신 웹 UI 엔진을 사용하므로 Android System WebView 또는 Chrome 업데이트가 필요합니다. 오래된 AOSP WebView 95에서는 최신 스타일 일부가 잘못 렌더링됐으며, WebView 124·134 환경에서는 정상 동작했습니다.

iOS 프로젝트와 handoff 문서는 준비되어 있습니다. Windows에서는 App Store 아카이브, 코드 서명, iOS Simulator 테스트를 수행할 수 없으므로 macOS와 Xcode에서 컴파일·시뮬레이터·실기기 검증을 이어가야 합니다.
