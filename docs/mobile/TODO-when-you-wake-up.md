# Play 비공개 테스트 인계 체크리스트

기준일: 2026-07-19
배포 후보: 0.2.0 (versionCode 2)

## 로컬 완료

- [x] 서명된 AAB와 APK 생성
- [x] Bundletool·apksigner·업로드 인증서 검증
- [x] 테스트 60개, ESLint, npm audit, 웹·모바일 빌드
- [x] Android API 35 휴대전화 서명 릴리스 설치·콜드 스타트
- [x] Android API 36 태블릿 서명 릴리스 설치·가로 레이아웃
- [x] 저장 장소, 태그, 검색, 상세, 방문, 사진, 리뷰, XP 검증
- [x] 포그라운드 GPS와 카메라 권한 흐름 검증
- [x] 강제 종료·업데이트 설치 후 로컬 데이터 유지
- [x] JSON 내보내기·앱 데이터 초기화·전체 복원
- [x] 민감 백업 데이터 로그 미노출
- [x] 국문·영문 정책, 등록정보, 출시 노트와 테스터 미션
- [x] GPT 이미지 통합과 실제 앱 휴대전화·태블릿 스크린샷

## Play Console에서 남음

- [ ] 0.2.0 AAB 업로드
- [ ] 권한·데이터 보안·앱 액세스·콘텐츠 등급 갱신
- [ ] 국문 기본 등록정보와 별도 영문 등록정보 입력
- [ ] 아이콘·그래픽·휴대전화·태블릿 스크린샷 업로드
- [ ] 0.2.0-alpha2 비공개 테스트 출시
- [ ] 실제 테스터 15명 이상 모집
- [ ] 최소 12명 14일 연속 옵트인 유지
- [ ] 미션·피드백·수정 증거 기록
- [ ] 프로덕션 액세스 신청

## 공개 출시 전 남음

- [ ] 더미 POI 100건을 출처·좌표·라이선스가 검증된 실제 데이터로 교체
- [ ] 실제 POI 기준 스토어 문구와 스크린샷 재검수
- [ ] 대표 Android 실기기 회귀 검증
- [ ] macOS와 Xcode에서 iOS 컴파일·Simulator·실기기·서명 검증

## 핵심 파일

    android/app/build/outputs/bundle/release/app-release.aab
    android/app/build/outputs/apk/release/app-release.apk
    docs/mobile/closed-test/evidence/report-0.2.0.md
    docs/mobile/google-play-closed-testing.md
    docs/mobile/store-assets/
    docs/mobile/closed-test/
    public/privacy.html

## 보안 주의

업로드 키와 속성 파일은 C:\Users\sinmb\key에 보관합니다. 암호, 키 파일, 실제 테스터 이메일과 내보낸 사용자 JSON은 GitHub에 커밋하지 않습니다.
