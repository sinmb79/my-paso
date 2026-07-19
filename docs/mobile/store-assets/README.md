# Google Play 업로드 에셋

기준일: 2026-07-19

| 파일 | 규격 | 용도·출처 |
|---|---:|---|
| icon-512.png | 512 x 512 PNG | Play 앱 아이콘 |
| feature-graphic.png | 1024 x 500, 24-bit PNG | GPT 이미지 기반 그래픽 |
| screenshot-01-map.png | 1080 x 2400 PNG | 실제 휴대전화 지도 |
| screenshot-02-explore.png | 1080 x 2400 PNG | 실제 휴대전화 탐색 |
| screenshot-03-journal.png | 1080 x 2400 PNG | 실제 휴대전화 저널 |
| screenshot-04-profile.png | 1080 x 2400 PNG | 실제 휴대전화 프로필 |
| screenshot-05-tablet-landscape.png | 2560 x 1600 PNG | 실제 Android 태블릿 지도 |
| icon-512.html | 512 x 512 | 아이콘 재생성 원본 |
| feature-graphic.html | 1024 x 500 | 그래픽 재생성 원본 |
| store-listing.txt | 국문·영문 | Play Console 등록 문구 |

feature-graphic.png는 앱에 통합한 public/brand/paso-memory-trail-hero.webp를 사용해 제품의 기억 산책 콘셉트와 실제 UI의 색감을 맞췄습니다. 스크린샷은 합성 화면이 아니라 Android 에뮬레이터에서 실행한 0.2.0 `versionCode 4` 앱 화면입니다. 휴대전화 API 35와 태블릿 API 36에서 Wikidata CC0 기반 실제 장소 100건으로 다시 촬영했습니다.

재생성:

    npm run play:assets

스크린샷 재검수: 2026-07-19 완료. 지도·탐색 화면에 더미 ID와 테스트 장소명이 없고 실제 장소명과 `등록 장소` 문구가 표시됩니다.

개인정보처리방침:

    https://sinmb79.github.io/my-paso/privacy.html
