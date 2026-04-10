# Hello! My Paso!

API 키가 없어도 바로 실행되는 로컬-퍼스트 여행 기록 앱 셸입니다.  
영문 설명은 [README.en.md](./README.en.md)에서 따로 볼 수 있습니다.

## 한눈에 보기

```mermaid
flowchart LR
  Seed["더미/실데이터 시드"] --> Loader["loadSeedPOIs()"]
  Loader --> DB["wa-sqlite<br/>브라우저 SQLite"]
  DB --> Map["맵 셸 / Focused POI"]
  DB --> Journal["방문 / 리뷰 / XP"]
  Journal --> Export["JSON 백업/복원"]
```

## 지금 되는 것

| 항목 | 설명 |
| --- | --- |
| 앱 셸 | Next.js App Router 기반 정적 배포 가능 구조 |
| 로컬 DB | `wa-sqlite` + 브라우저 저장소 |
| 더미 시드 | 기본 100개 POI 번들 포함 |
| 실데이터 교체 경로 | `seed:live`, `seed:merge` 스크립트 제공 |
| 맵 화면 | Mapbox 토큰이 없어도 fallback UI 동작 |
| 저널 흐름 | 방문 기록, 리뷰 저장, XP/프로필 갱신 |
| 백업/복원 | `Export local JSON`, `Import local JSON` 지원 |
| 공개배포 | GitHub Pages 정적 호스팅 대응 |

## 시스템 구조

| 경로 | 역할 |
| --- | --- |
| `src/app/page.tsx` | 홈 화면 서버 셸 |
| `src/components/home/HomeWorkspace.tsx` | 홈 화면 클라이언트 진입점 |
| `src/components/map/MapView.tsx` | 맵/fallback/focused POI UI |
| `src/components/home/PasoJournal.tsx` | 방문, 리뷰, 백업/복원 UI |
| `src/hooks/usePasoJournal.ts` | 로컬 상태와 액션 통합 훅 |
| `src/lib/db/*` | SQLite 초기화, 마이그레이션, 쿼리 |
| `src/lib/export/json-export.ts` | snapshot export / restore |
| `src/lib/poi/pois-dummy.json` | 기본 POI 시드 |
| `scripts/seed-pois.mjs` | 더미 생성, 실데이터 fetch, 병합 스크립트 |

## 빠른 시작

```bash
npm install
npm run seed:dummy
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면, Mapbox 토큰이 없어도 fallback 맵과 로컬 저널 화면을 바로 확인할 수 있습니다.

## 시드 교체

```bash
# 더미 100건 재생성
npm run seed:dummy

# 공공 API 엔드포인트에서 직접 번들 생성
npm run seed:live

# 미리 받아둔 JSON 파일을 병합해 번들 생성
npm run seed:merge -- --tour=./tmp/tourapi.json --heritage=./tmp/heritage.json
```

`.env.example`에 필요한 항목:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
TOUR_API_URL=
TOUR_API_KEY=
HERITAGE_API_URL=
CHA_API_KEY=
```

주의:
- 실제 키 파일이나 `.env`는 저장소에 올리지 않습니다.
- 로컬 비밀 저장소에서 읽어 실행하는 방식으로만 사용합니다.

## 백업과 복원

홈 화면 상단의 버튼으로 현재 로컬 데이터를 JSON으로 내보내거나 다시 불러올 수 있습니다.

- `Export local JSON`: 현재 기기 데이터를 snapshot으로 저장
- `Import local JSON`: 선택한 snapshot으로 현재 로컬 상태를 교체

## 검증

```bash
npm run test
npm run lint
npm run build
```

## 관련 문서

- [영문 설명서](./README.en.md)
- [Phase 0 스펙](../hello-my-paso_phase0_spec.md)
- [Local-First 보강 문서](../hello-my-paso_local-first_addendum.md)
- [구현 계획](../docs/superpowers/plans/2026-04-08-phase0-foundation.md)

## 모바일 문서

안드로이드 재현 문서와 iOS 인계 문서는 아래 링크에서 바로 볼 수 있습니다.  
Android reproduction notes and the iOS handoff guide are available below.

- [Android Setup](./docs/mobile/android-setup.md)
- [iOS Handoff](./docs/mobile/ios-handoff.md)
