# Play 비공개 테스트 인계 체크리스트

기준일: 2026-07-19
현재 게시 버전: 0.2.0-alpha2 (versionCode 3)
검토 중 업데이트: 0.2.0-alpha3 (versionCode 4)

## 로컬 완료

- [x] 서명된 AAB와 APK 생성
- [x] Bundletool·apksigner·업로드 인증서 검증
- [x] 테스트 63개, ESLint, npm audit, 웹·모바일 빌드
- [x] Android API 35 휴대전화 서명 릴리스 설치·콜드 스타트
- [x] Android API 36 태블릿 서명 릴리스 설치·가로 레이아웃
- [x] 저장 장소, 태그, 검색, 상세, 방문, 사진, 리뷰, XP 검증
- [x] 포그라운드 GPS와 카메라 권한 흐름 검증
- [x] 강제 종료·업데이트 설치 후 로컬 데이터 유지
- [x] JSON 내보내기·앱 데이터 초기화·전체 복원
- [x] 민감 백업 데이터 로그 미노출
- [x] 국문·영문 정책, 등록정보, 출시 노트와 테스터 미션
- [x] GPT 이미지 통합과 실제 앱 휴대전화·태블릿 스크린샷

## Play Console과 테스트 운영에서 남음

- [x] 0.2.0-alpha3 (versionCode 4) 실제 POI AAB를 같은 Alpha 트랙에 업로드·제출
- [ ] 0.2.0-alpha3 Google 검토 승인과 Alpha 트랙 자동 게시 확인
- [x] 0.2.0 (versionCode 3) AAB 업로드
- [x] 권한·데이터 보안·앱 액세스·콘텐츠 등급 확인
- [x] 국문 기본 등록정보와 별도 영문 등록정보 입력
- [x] 아이콘·그래픽·휴대전화·태블릿 스크린샷 업로드
- [x] 0.2.0-alpha2 비공개 테스트 100% 출시안을 Google 검토에 제출
- [x] Google 검토 승인과 Alpha 트랙 자동 게시 확인
- [x] Alpha 테스터 이메일 목록 44명 등록, Play 대시보드의 12명 이상 옵트인 조건 확인
- [ ] 최소 12명 14일 연속 옵트인 유지
- [ ] 미션·피드백·수정 증거 기록
- [ ] 프로덕션 액세스 신청

## 공개 출시 전 남음

- [x] 더미 POI 100건을 Wikidata CC0 기반 대한민국 실제 데이터 100건으로 교체
- [x] QID·좌표·국가·중복·카테고리·매니페스트 해시 자동 검증
- [x] 실제 POI 기준 국영문 스토어 문구와 휴대전화·태블릿 스크린샷 재검수
- [x] Android API 35 휴대전화와 API 36 태블릿에 기존 v2 위 v4 업데이트 설치 회귀 검증
- [ ] 운영·폐업과 출입구 수준 좌표가 중요한 POI의 프로덕션 전 사람 검수
- [ ] macOS와 Xcode에서 iOS 컴파일·Simulator·실기기·서명 검증

## 핵심 파일

    android/app/build/outputs/bundle/release/app-release.aab
    android/app/build/outputs/apk/release/app-release.apk
    docs/mobile/closed-test/evidence/report-0.2.0-alpha3.md
    docs/mobile/closed-test/evidence/report-0.2.0.md (게시된 alpha2 역사 기록)
    docs/mobile/google-play-closed-testing.md
    docs/mobile/store-assets/
    docs/mobile/closed-test/
    public/privacy.html

## 보안 주의

업로드 키와 속성 파일은 C:\Users\sinmb\key에 보관합니다. 암호, 키 파일, 실제 테스터 이메일과 내보낸 사용자 JSON은 GitHub에 커밋하지 않습니다.
