# Google Play 등록 에셋

기준일: 2026-08-11

| 파일 | 규격 | 용도·출처 |
|---|---:|---|
| `icon-512.png` | 512 × 512 PNG | Play 앱 아이콘 |
| `feature-graphic.png` | 1024 × 500, 24-bit PNG | GPT 이미지 기반 브랜드 그래픽 |
| `screenshot-01-map.png` | 1080 × 2400 PNG | Android 16 에뮬레이터 실제 지도 화면 |
| `screenshot-02-explore.png` | 1080 × 2400 PNG | Android 16 에뮬레이터 실제 탐색 화면 |
| `screenshot-03-journal.png` | 1080 × 2400 PNG | Android 16 에뮬레이터 실제 기록 및 AI 작성 동작 |
| `screenshot-04-profile.png` | 1080 × 2400 PNG | Android 16 에뮬레이터 실제 프로필 및 로컬 AI 설정 |
| `screenshot-05-tablet-landscape.png` | 2560 × 1440 PNG | Android 16 태블릿 에뮬레이터 가로 지도 화면 |
| `icon-512.html` | 512 × 512 | 아이콘 생성 원본 |
| `feature-graphic.html` | 1024 × 500 | 그래픽 생성 원본 |
| `store-listing.txt` | 국문·영문 | Play Console 등록 문구 |

`feature-graphic.png`에는 제품의 기억 여정 콘셉트와 실제 UI의 질감을 맞추기 위해
`public/brand/paso-memory-trail-hero.webp`를 통합했습니다. 스크린샷은 합성 이미지가
아니라, 최종 서명된 `0.3.0` (`versionCode 6`) APK를 Android 16 에뮬레이터에서 실행하여
다시 촬영한 결과입니다.

검증 데이터는 Wikidata 기반 실제 장소 100건과 테스트 전용 더미 AI 엔드포인트·데이터만
사용했습니다. 개인 계정, 개인 사진, 실제 기록 또는 비밀값은 촬영·저장하지 않았습니다.
전화면은 1080 × 2400, 태블릿 화면은 2560 × 1440으로 최종 재검수까지 완료했습니다.

2026-08-11 Play Console 제출에서는 신규 휴대전화 4장과 수정된 태블릿 화면을
AI-generated/modified로 라벨했습니다. 기존 아이콘, feature graphic, 이전 스크린샷에는
해당 라벨을 적용하지 않았습니다.

재생성:

    npm run play:assets

개인정보처리방침:

    https://sinmb79.github.io/my-paso/privacy.html
