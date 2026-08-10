# Hello! My Paso!

API 키와 계정 없이 바로 실행되는 로컬-퍼스트 장소 기억 앱입니다. 장소를 발견하고 저장한 뒤, 현장 또는 수동 방문과 사진·감상을 기본적으로 기기 안에 쌓습니다. 영문 설명은 [README.en.md](./README.en.md)에서 별도로 제공합니다.

## 제품 흐름

```mermaid
flowchart LR
  Seed["더미/실데이터 시드"] --> DB["wa-sqlite + IndexedDB"]
  DB --> Map["오프라인 지도 / 장소 탐색"]
  DB --> Collection["저장 / 태그 / 검색"]
  Collection --> Journal["GPS·수동 방문 / 사진 / 회고"]
  Journal --> Insight["타임라인 / 월간 회고 / 성취"]
  Journal --> Export["체크섬 JSON + 사진 백업"]
```

## 지금 되는 것

| 항목 | 설명 |
| --- | --- |
| 앱 | Next.js 정적 앱 + Capacitor Android/iOS 프로젝트 |
| 로컬 DB | `wa-sqlite` + IndexedDB, 휘발성 폴백에서는 쓰기 차단 |
| 시드 | API 키 없이 테스트 가능한 100개 POI 번들, 실데이터 교체 스크립트 포함 |
| 지도·탐색 | Mapbox 토큰 없는 오프라인 지도, 이름·지역·개인 태그 검색 |
| 개인 컬렉션 | 교체 가능한 시드와 분리된 저장 상태·태그·방문 상태 |
| 저널 | GPS 확인/수동 방문 구분, 사진, 감상, 날짜별 타임라인 |
| 선택적 로컬 AI | 사용자가 확인한 localhost/사설망 실행기로만 보내는 기록·분류·키워드 초안 |
| 회고 | 월간 요약, 정확한 레벨 진행, 실제 데이터 기반 성취 |
| 백업 | 전체 기록·사진·저장 정보를 SHA-256과 참조 무결성 검사 후 원자적으로 복원 |

## 핵심 경로

| 경로 | 역할 |
| --- | --- |
| `src/components/home/HomeWorkspace.tsx` | 앱 화면과 탭 상태 통합 |
| `src/components/tabs/*` | 지도, 탐색, 저널, 프로필 화면 |
| `src/hooks/usePasoJournal.ts` | 로컬 상태와 쓰기 안전 게이트 |
| `src/lib/db/*` | 버전드 SQLite 마이그레이션과 쿼리 |
| `src/lib/media/photo-store.ts` | 웹 IndexedDB/네이티브 파일 사진 저장소 |
| `src/lib/export/json-export.ts` | 스냅샷 검증·내보내기·보상 복원 |
| `src/lib/poi/pois-dummy.json` | 기본 100개 POI 시드 |
| `scripts/seed-pois.mjs` | 더미 생성, 실데이터 수집·병합 |

## 빠른 시작

```bash
npm install
npm run seed:dummy
npm run dev
```

`http://localhost:3000`에서 Mapbox나 공공 API 키 없이 주요 흐름을 확인할 수 있습니다.

## 시드 교체

```bash
npm run seed:dummy
npm run seed:live
npm run seed:merge -- --tour=./tmp/tourapi.json --heritage=./tmp/heritage.json
```

비밀 키는 `.env`에만 두고 저장소에는 커밋하지 않습니다. 필요한 변수는 [.env.example](./.env.example)을 참고하세요.

## 선택적 로컬 AI와 전송 경계

로컬 AI는 선택 사항이며 모델 가중치를 앱에 포함하지 않습니다. 소유자가 별도로 실행하는 OpenAI 호환 한국어 모델을 설정해야 하며, AI를 끄거나 설정하지 않아도 모든 수동 기록 기능을 사용할 수 있습니다.

- 앱은 이 기기의 HTTP/HTTPS `localhost`·loopback 또는 사용자가 정확한 주소를 다시 확인한 HTTPS 사설망 IPv4 엔드포인트만 허용합니다. HTTP 사설망, 공개 인터넷, 클라우드 및 개발자 운영 엔드포인트는 차단합니다.
- 사용자가 전송 미리보기를 읽고 **이 내용으로 AI 초안 만들기**를 명시적으로 누른 뒤에만 선택한 장소 이름·메모를 보냅니다. 비전 모델에서는 EXIF를 제거하고 축소한 임시 사진 복사본만 추가합니다.
- HTTPS 사설망 전송은 기기 밖 전송입니다. 해당 엔드포인트 운영자는 내용을 처리할 수 있고 전송 구간은 플랫폼 TLS로 암호화됩니다. HTTP localhost는 같은 기기 안에서만 처리됩니다.
- 개발자는 AI 엔드포인트를 운영하지 않으며 전송 내용을 수신, 보관 또는 열람하지 않습니다. 정확한 위치, 사진 메타데이터, 다른 기록과 백업은 AI 요청에서 제외합니다.
- 결과는 편집 가능한 초안일 뿐입니다. 자동 저장·동기화·공유하지 않으며, 사용자가 초안을 적용한 뒤에도 일반 저장 동작을 해야 기록됩니다.

## 백업과 권한

- 프로필의 **내 데이터 보관**에서 장소, 방문, 감상, XP, 저장·태그와 참조 사진을 JSON으로 내보냅니다.
- 가져오기는 버전, 건수, 참조, SHA-256 체크섬을 검사하고 미리보기를 보여준 뒤 실행합니다.
- 복원 중 오류가 나면 DB와 사진을 원래 상태로 되돌립니다.
- 위치는 사용자가 **현재 위치 확인**을 누를 때만 사용하며 백그라운드 추적은 하지 않습니다.
- 카메라·사진은 사용자가 방문 사진을 추가할 때만 사용합니다.
- JSON에는 위치와 사진이 포함될 수 있고 별도 암호화되지 않으므로 안전하게 보관해야 합니다.
- 사설망 AI에는 신뢰하는 소유자 실행기와 유효한 HTTPS 인증서를 사용하고, 전송 전 미리보기를 확인하세요. HTTP 사설망 주소는 사용할 수 없습니다.

## 검증

```bash
npm test
npm run lint
npm run build
npm run build:mobile
npm run cap:sync:android
```

## 문서

- [영문 설명서](./README.en.md)
- [Android 설정](./docs/mobile/android-setup.md)
- [iOS 인계](./docs/mobile/ios-handoff.md)
- [제품 정렬 분석](./docs/product/2026-07-19-benchmark-and-concept-alignment.md)
- [제품 보완 로드맵](./docs/superpowers/plans/2026-07-19-product-alignment-roadmap.md)
