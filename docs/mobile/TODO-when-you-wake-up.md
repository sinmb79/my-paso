# Play 비공개 테스트 인계 체크리스트

기준일: 2026-08-11 KST
현재 게시 버전: 0.2.0-alpha4 (versionCode 5)
검토 중 업데이트: 0.3.0 (versionCode 6, `0.3.0-alpha1`)
현재 상태: `검토 중인 변경사항`, 빠른 검사 실행 중

## 현재 Alpha 제출 상태

- [x] 2026-08-11에 Alpha `0.3.0-alpha1` / versionCode 6을 제출했습니다.
- [x] Alpha, 국문·영문 등록정보, 휴대전화·7인치·10인치 스크린샷, 개인정보처리방침 URL과 Data safety를 포함한 13개 변경사항을 전송했습니다.
- [x] `Photos`와 `Other user-generated content`를 선택 사항·앱 기능 목적의 수집 Yes로, 공유 No와 전송 중 암호화 Yes로 제출했습니다.
- [x] 새 휴대전화 4장과 수정된 태블릿 화면은 AI-generated/modified로 라벨했습니다. 기존 아이콘·feature graphic·이전 스크린샷은 라벨 대상이 아닙니다.
- [x] Play의 비차단 경고 2건(R8/Proguard mapping 부재, native debug symbols 부재)을 확인했습니다.
- [ ] 빠른 검사와 Google 검토 결과를 확인하고, 승인 후 Alpha 자동 게시·테스터 배포 상태를 기록합니다.
- [ ] 최소 12명 14일 연속 옵트인 유지, 미션·피드백·수정 증거 기록, 프로덕션 액세스 신청을 진행합니다.

## 릴리스 증거와 보안

- [x] 최종 AAB: 8,277,246 bytes, SHA-256 `F4F386B760F3A71F4D8BF2DDE89528B41CF93713811C475C77EC832C17584679`.
- [x] 새 설치 7.44 MB, 업데이트 5.98 MB, 지원 기기 변화 0을 확인했습니다.
- [x] 더미 데이터와 더미 전용 AI 엔드포인트만 사용했습니다. 개인 사진·기록·비밀값을 증거와 스크린샷에 포함하지 않았습니다.
- [x] GitHub 공개를 완료했습니다: [v0.3.0](https://github.com/sinmb79/my-paso/releases/tag/v0.3.0)는 public non-draft prerelease이며, annotated tag는 `b5eb35402deeb868c1fdb6d69f9f76443ae3a41c`로 peel됩니다. 이후 증적 문서 커밋은 docs-only이며 게시 태그를 이동하지 않습니다.

## 2026-07-19 역사 인계 기록 (현재 상태 아님)

아래는 당시의 `0.2.0-alpha2`/`0.2.0-alpha3` 작업 스냅샷입니다. 현재 Alpha 상태나 남은 Play 작업을 나타내지 않으며, 배경 이력으로만 보존합니다.

- 당시 서명 AAB·APK, Bundletool·apksigner, 로컬 웹·모바일 빌드와 Android API 35/36 설치 검증을 완료했습니다.
- 당시 실제 POI AAB를 Alpha에 업로드했고, 국문·영문 등록정보와 스크린샷을 준비했습니다.
- 당시 공개 출시 전 사람 POI 검수와 iOS 검증은 후속 항목이었습니다.

## 핵심 파일

    android/app/build/outputs/bundle/release/app-release.aab
    android/app/build/outputs/apk/release/app-release.apk
    docs/mobile/closed-test/evidence/report-0.3.0.md
    docs/mobile/google-play-closed-testing.md
    docs/mobile/data-safety-0.3.0.md
    docs/mobile/store-assets/
    docs/mobile/closed-test/
    public/privacy.html

## 보안 주의

업로드 키와 속성 파일은 `C:\Users\sinmb\key`에 보관합니다. 암호, 키 파일, 실제 테스터 이메일과 내보낸 사용자 JSON은 GitHub에 커밋하지 않습니다.
