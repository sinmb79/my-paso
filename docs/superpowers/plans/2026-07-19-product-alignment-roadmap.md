# Hello! My Paso! 제품 정렬 및 보완 구현 계획

> **상태:** 실행 전 계획
> **작성일:** 2026-07-19
> **근거 보고서:** `docs/product/2026-07-19-benchmark-and-concept-alignment.md`
> **목표:** 경쟁 앱의 검증된 패턴과 브랜드 콘셉트를 local-first 원칙을 훼손하지 않고 실제 제품 기능으로 전환한다.

## 1. 목표와 비목표

### 목표

- 모든 개인 기록을 제한 없이 백업하고, 안전하게 미리 검증한 뒤 복원한다.
- 사용자가 장소를 `발견 -> 저장 -> 방문 -> 기록 -> 다시 회상`하는 하나의 흐름을 만든다.
- 콘셉트 이미지의 여정선, 장소 핀, 기억, 성취를 실제 UI 의미와 연결한다.
- 위치·사진 기능은 명시적 동의와 점진적 향상으로 제공한다.
- API 키가 없어도 100건 더미 시드로 전체 앱과 테스트가 계속 동작한다.
- Android 휴대폰·태블릿과 추후 iPhone·iPad에서 동일한 핵심 데이터 계약을 유지한다.

### 비목표

- 백그라운드 또는 상시 위치 추적
- 소셜 피드, 공개 프로필, 친구, 리더보드
- 계정·서버·자동 클라우드 동기화
- 턴바이턴 내비게이션, 예약, 예산, AI 일정 생성
- 핵심 오프라인 기능이나 로컬 기록 수의 유료 제한

## 2. 핵심 아키텍처 결정

### 2.1 local-first 경계

```text
Bundled POI seed --> wa-sqlite user database --> local media store
                          |                         |
                          +------ backup v2 -------+

Optional runtime services:
- Mapbox visual map only when a token and network are available
- Foreground location only after an explicit user action

Never required for core flow:
- account
- backend
- analytics SDK
- runtime TourAPI/heritage API
```

비공개 테스트와 기본 릴리스는 Mapbox 토큰 없이도 완전한 핵심 흐름을 제공한다. 토큰을 포함하는 빌드는 지도 타일·스타일의 원격 요청과 공급자 정책을 개인정보처리방침에 반영하고, 저널·사진·개인 태그가 요청에 포함되지 않는지 네트워크 검사로 확인한다.

### 2.2 canonical POI와 사용자 데이터를 분리한다

`pois`는 빌드 시드로 갱신될 수 있는 공공/기준 데이터다. 저장 여부, 개인 태그, 개인 메모를 `pois`에 직접 추가하면 시드 교체 시 충돌한다. 사용자 데이터는 별도 테이블에 둔다.

```sql
CREATE TABLE poi_user_state (
  poi_id TEXT PRIMARY KEY REFERENCES pois(id) ON DELETE CASCADE,
  saved_at TEXT,
  personal_note TEXT,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color_token TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE poi_tags (
  poi_id TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (poi_id, tag_id)
);
```

- `가볼 곳`은 `saved_at`으로 표현한다.
- `다녀온 곳`은 `visits` 존재 여부로 계산한다. 중복 상태를 저장하지 않는다.
- 더미 시드가 실제 시드로 바뀌어도 POI ID가 안정적이면 사용자 상태가 유지되어야 한다.

### 2.3 실제 버전 마이그레이션을 도입한다

현재 `CREATE TABLE IF NOT EXISTS`만 실행하는 방식은 기존 설치에 컬럼·테이블 변경을 적용할 수 없다. 다음 단계부터 `schema_migrations(version, applied_at)`와 순차 마이그레이션을 사용한다.

- 각 마이그레이션은 한 트랜잭션에서 실행한다.
- 동일 마이그레이션을 두 번 실행해도 결과가 안전해야 한다.
- 기존 비공개 테스트 DB의 방문·리뷰·XP를 보존한다.
- 마이그레이션 실패 시 앱은 쓰기 작업을 중지하고 복구 안내를 보여준다.

### 2.4 사진은 SQLite Data URL로 저장하지 않는다

사진 원본은 파일/Blob 저장소에 두고 DB에는 메타데이터와 참조만 저장한다.

```sql
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL
);
```

- Android/iOS: Capacitor Filesystem의 앱 전용 디렉터리
- Web/PWA: 별도 IndexedDB Blob store
- `visits.photo_ids`와 `reviews.photo_ids`는 당분간 기존 JSON 참조를 유지하되, 참조 무결성을 앱 계층에서 검증한다.
- 백업 v2는 JSON 메타데이터와 미디어 파일을 하나의 아카이브로 묶는 방식을 사용한다.

### 2.5 위치 확인은 사용자가 시작하고 사용자가 확정한다

- 기본 방문 기록은 계속 수동이다.
- `현재 위치로 확인`을 누른 경우에만 한 번 위치를 요청한다.
- 가장 가까운 POI와 거리·정확도를 보여주고 사용자가 확인해야 방문이 기록된다.
- 원시 이동 경로를 수집하지 않는다.
- 방문 레코드에는 기본적으로 POI 중심 좌표와 검증 거리만 저장해 정밀 위치 보관을 줄인다.
- `ACCESS_BACKGROUND_LOCATION`은 추가하지 않는다.

## 3. 단계와 예상 범위

작업일 추정은 1인 개발 기준이며, 스토어 심사와 API 키 발급 대기 시간은 제외한다.

| 단계 | 결과 | 예상 작업일 | 출시 게이트 |
|---|---|---:|---|
| P0 | 데이터 안전성과 명세 갱신 | 3~5일 | 비공개 테스트 확대 전 필수 |
| P1 | 저장·태그·검색·장소 상세 | 5~8일 | 기능 비공개 테스트 |
| P2 | 타임라인·이날의 기억·사진 | 7~10일 | 사진 정책/권한 갱신 후 |
| P3 | 의미 있는 성취·로컬 회고 | 4~6일 | 과도한 게임화 사용자 테스트 |
| P4 | 전경 위치 확인 | 5~8일 + 현장 시험 | 위치 정책/현장 합격 후 |
| P5 | 실제 POI 시드·지도 고도화 | 5~10일 + 데이터 검수 | 키 없이 더미 폴백 필수 |
| P6 | 최종 스토어 자산·회귀 검증 | 3~5일 | Android closed track, iOS handoff |

## 4. 구현 작업

### Task 0: 다음 제품 단계의 계약을 먼저 승인한다

**변경 파일:**

- Create: `docs/superpowers/specs/2026-07-19-personal-place-memory-design.md`
- Modify: `AGENTS.md`
- Modify: `docs/mobile/google-play-closed-testing.md`

현재 `AGENTS.md`는 모바일 전달 단계에서 `migrations.ts`, `queries.ts`, `json-export.ts`를 변경하지 말라고 명시한다. 이번 계획은 해당 단계 이후의 제품 개발이므로, 코드 변경 전에 새 설계를 authoritative spec으로 지정하고 금지 범위를 갱신한다.

**합격 기준:**

- local-first, 수동 우선, API 키 없는 더미 시드, 백그라운드 위치 금지 규칙이 새 명세에 명시된다.
- 기존 모바일 전달 문서의 완료 상태와 새 제품 단계가 섞이지 않는다.
- 작업 브랜치 또는 worktree를 새로 만들고 현재 더러운 작업 트리와 분리한다.

### Task 1: 영속성 게이트, 백업 v2, 안전한 복원을 완성한다

**변경 파일:**

- Modify: `src/types/index.ts`
- Modify: `src/lib/export/json-export.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `src/lib/db/sqlite.ts`
- Modify: `src/hooks/useLocalDB.ts`
- Modify: `src/lib/native/filesystem.ts`
- Create: `src/lib/native/share.ts`
- Modify: `src/components/tabs/ProfileTab.tsx`
- Modify: `src/components/home/HomeWorkspace.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `ios/App/PrivacyInfo.xcprivacy`
- Modify: `ios/App/App/Info.plist`
- Modify: `tests/unit/json-export.test.ts`
- Modify: `tests/unit/native-wrappers.test.ts`
- Modify: `tests/unit/sqlite.test.ts`

**구현:**

1. 네이티브 릴리스에서 `storageMode !== "indexeddb"`이면 방문·리뷰 쓰기를 금지하고, 데이터가 유지되지 않는 이유와 재시도·진단 경로를 보여준다. 조용한 `memory` 폴백 상태로 출시하지 않는다.
2. `getAllPOIsForExport`, `getAllVisitsForExport`, `getAllReviewsForExport` 전용 쿼리를 추가해 100건 제한을 제거한다.
3. `PasoSnapshotV2`에 `snapshot_version`, `schema_version`, `app_version`, 테이블별 `record_counts`, 체크섬을 추가한다.
4. 복원 전에 JSON 스키마, 버전 호환성, ID 중복, 외래키, 카운트, 체크섬을 모두 검사하는 `inspectPasoBackup`을 만든다.
5. UI에서 파일명, 생성일, 버전, POI·방문·리뷰·사진 수, 경고를 보여주고 사용자가 명시적으로 확정해야 복원한다.
6. 복원은 `BEGIN IMMEDIATE`부터 `COMMIT`까지 한 트랜잭션으로 실행하고, 오류 시 `ROLLBACK`한다.
7. 삽입 후 `PRAGMA foreign_key_check`와 레코드 카운트를 확인한다.
8. 네이티브에서는 `writeBackupFile`과 공식 Capacitor Share 플러그인을 사용해 저장 URI와 OS 공유/보관 경로를 제공한다. Android 11+의 `Directory.Documents`는 앱이 만든 파일만 다룰 수 있다는 제약을 테스트한다.
9. iOS Files 앱 노출이 필요하면 `UIFileSharingEnabled`와 `LSSupportsOpeningDocumentsInPlace`를 설정한다.
10. Capacitor Filesystem의 Apple 필수 사유 API 선언을 `PrivacyInfo.xcprivacy`에 추가한다.
11. v1 백업은 읽기 전용 변환기로 지원하고, 알 수 없는 미래 버전은 기존 데이터를 건드리지 않고 거부한다.
12. `모든 로컬 데이터 지우기`를 백업 권고, 두 단계 확인, 완료 검증과 함께 제공한다.

Capacitor v8의 파일시스템 제약과 Apple Privacy Manifest 요구사항은 [공식 Filesystem 문서](https://capacitorjs.com/docs/apis/filesystem)를 기준으로 구현한다.

**필수 테스트:**

- 150개 이상의 방문·리뷰·POI가 모두 내보내진다.
- export -> 빈 DB restore -> export 결과가 정규화된 해시로 동일하다.
- 손상 JSON, 중복 ID, 누락 POI, 잘못된 체크섬은 DELETE 이전에 거부된다.
- 삽입 중 강제 오류가 발생해도 기존 DB가 완전히 유지된다.
- Android에서 생성된 파일을 앱 재설치 전 별도 보관하고 새 설치에 복원할 수 있다.
- Android WebView에서 `storageMode === "indexeddb"`임을 확인하고, 앱 강제 종료·단말 재부팅 뒤 데이터가 유지된다.
- `navigator.locks` 부재를 모의한 테스트에서 쓰기 금지와 사용자 안내가 작동한다.

**검증 명령:**

```powershell
npm test -- tests/unit/json-export.test.ts tests/unit/native-wrappers.test.ts tests/unit/sqlite.test.ts
npm run lint
npm run build:mobile
```

### Task 2: 버전 마이그레이션과 개인 장소 상태를 추가한다

**변경 파일:**

- Modify: `src/lib/db/migrations.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `src/types/index.ts`
- Modify: `src/hooks/usePasoJournal.ts`
- Modify: `tests/unit/sqlite.test.ts`
- Modify: `tests/unit/queries.test.ts`

**구현:**

1. `schema_migrations`와 순차 마이그레이션 러너를 추가한다.
2. `poi_user_state`, `tags`, `poi_tags` 테이블과 인덱스를 추가한다.
3. 저장/해제, 개인 메모 수정, 태그 생성/삭제/연결 쿼리를 작성한다.
4. `visited`는 방문 집계로 계산하고 별도 불리언으로 저장하지 않는다.
5. 시드 재적용 시 `pois`만 upsert하고 개인 상태는 유지한다.
6. 사라진 공식 POI는 즉시 cascade 삭제하지 않고 `source_status = retired` 또는 보존 스냅샷 정책을 설계 스펙에서 확정한다.
7. `syncProfileAndStats`가 실제 사진 참조 수를 다시 계산하도록 보강한다.
8. 이동 경로가 없으므로 `total_distance_km`는 실제 이동 거리로 계산하지 않는다. 신뢰할 수 있는 경로 모델이 생기기 전에는 프로필에서 숨기거나 `장소 간 직선 연결 거리`라고 명확히 구분한다.

**필수 테스트:**

- 기존 v0.1 DB를 마이그레이션한 뒤 기존 방문·리뷰·XP가 그대로 남는다.
- 같은 마이그레이션을 재실행해도 데이터와 버전이 변하지 않는다.
- 더미 시드에서 실제 시드로 교체해도 동일 ID의 저장·태그가 유지된다.
- 태그 대소문자 중복과 고아 연결이 생기지 않는다.

### Task 3: 검색·필터·장소 상세 흐름을 만든다

**변경 파일:**

- Create: `src/components/places/PlaceDetailSheet.tsx`
- Create: `src/components/places/PlaceSearchBar.tsx`
- Create: `src/components/places/PlaceFilterBar.tsx`
- Modify: `src/components/tabs/ExploreTab.tsx`
- Modify: `src/components/tabs/MapTab.tsx`
- Modify: `src/components/home/HomeWorkspace.tsx`
- Modify: `src/hooks/usePasoJournal.ts`
- Modify: `tests/unit/map-tab.test.tsx`
- Create: `tests/unit/place-detail.test.tsx`

**구현:**

1. 검색은 이름, 설명, 지역, 구·군, 사용자 태그를 대상으로 한다.
2. 필터는 `전체`, `가볼 곳`, `다녀온 곳`, 카테고리, 지역을 제공한다.
3. 1,000개까지는 단순 SQLite/메모리 검색으로 시작하고, FTS5는 현재 wa-sqlite 빌드 지원 여부를 확인한 후에만 도입한다.
4. 지도와 탐색 카드가 같은 `PlaceDetailSheet`를 연다.
5. 상세 시트에는 설명, 출처, 저장, 태그, 방문 횟수, 최근 기록, `수동 방문 기록`, 추후 `현재 위치로 확인` 자리를 제공한다.
6. 상세 시트에서 저널로 이동해도 선택 POI가 유지되고 뒤로 가면 이전 지도/필터 상태로 돌아온다.
7. Mapbox 인스턴스는 최초 한 번 생성하고, POI 선택 때 지도를 재생성하지 않고 마커 상태와 카메라만 갱신한다.

**합격 기준:**

- `탐색 -> 저장 -> 태그 -> 지도에서 확인 -> 방문 기록`이 탭 상태 손실 없이 이어진다.
- 검색 결과가 1,000 POI에서 P95 100ms 이내다.
- 빈 검색, 결과 없음, retired POI, 긴 장소명, 스크린리더 레이블을 처리한다.

### Task 4: 기억 타임라인과 `이날의 기억`을 추가한다

**변경 파일:**

- Create: `src/lib/journal/timeline.ts`
- Create: `src/components/journal/MemoryTimeline.tsx`
- Create: `src/components/journal/OnThisDayCard.tsx`
- Modify: `src/lib/db/queries.ts`
- Modify: `src/components/tabs/JournalTab.tsx`
- Modify: `src/hooks/usePasoJournal.ts`
- Create: `tests/unit/timeline.test.ts`
- Create: `tests/unit/journal-tab.test.tsx`

**구현:**

1. 방문과 리뷰를 하나의 `TimelineEvent`로 정규화한다.
2. 날짜·지역·카테고리·태그별 필터를 제공한다.
3. 같은 방문의 리뷰는 중복 카드가 아니라 한 기억 카드 안에 결합한다.
4. `이날의 기억`은 기기 로컬 타임존 기준 월·일로 계산하고 1년 이전 기록만 노출한다.
5. 기록 편집과 삭제는 확인 단계와 XP/통계 재계산을 포함한다.
6. 타임라인 세로선에 콘셉트의 호박빛 `여정 리본`을 적용한다.

**필수 테스트:**

- UTC 자정 전후와 한국 표준시에서 날짜가 올바르게 묶인다.
- 리뷰가 있는 방문이 중복 노출되지 않는다.
- 방문 삭제 시 리뷰, XP 로그, 통계의 정책이 일관되게 적용된다.
- `prefers-reduced-motion`에서 선 그리기 애니메이션이 비활성화된다.

### Task 5: 로컬 사진 첨부와 미디어 백업을 구현한다

**변경 파일:**

- Create: `src/lib/media/media-store.ts`
- Create: `src/lib/media/native-media-store.ts`
- Create: `src/lib/media/web-media-store.ts`
- Modify: `src/lib/native/camera.ts`
- Create: `src/hooks/useCameraRecovery.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/db/migrations.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `src/components/tabs/JournalTab.tsx`
- Modify: `src/lib/export/json-export.ts`
- Modify: `tests/unit/native-wrappers.test.ts`
- Create: `tests/unit/media-store.test.ts`

**구현:**

1. 사진 선택/촬영 후 방향 보정, 최대 긴 변 2048px, 품질 80~85%로 로컬 처리한다.
2. 원본 Data URL을 SQLite에 넣지 않고 `media_assets`와 파일 저장소에 쓴다.
3. 저장 전 예상 용량, 저장 후 실제 용량을 관리하고 고아 파일 정리 작업을 제공한다.
4. 방문·리뷰 카드에 썸네일과 대체 텍스트 입력을 제공한다.
5. 백업 아카이브에는 manifest, SQLite/JSON 데이터, 미디어 파일, 각 파일 SHA-256을 포함한다.
6. 사진 기능을 켜기 전에 Google Play 데이터 보안, 개인정보처리방침, Android/iOS 권한 설명을 다시 검토한다.
7. 백업 아카이브 라이브러리는 브라우저·Capacitor 호환성, 스트리밍, 유지보수, 번들 크기를 비교한 뒤 선택하고, 전체 미디어를 메모리에 한 번에 올리는 구현은 금지한다.
8. Android가 카메라 Activity 실행 중 앱 프로세스를 종료할 수 있으므로 공식 `@capacitor/app`의 `appRestoredResult`를 처리해 촬영 결과 유실과 고아 파일을 방지한다.

iOS 카메라·사진 보관 문구와 Android Photo Picker/Activity 복구 요구사항은 [공식 Camera 문서](https://capacitorjs.com/docs/apis/camera)를 기준으로 구현한다.

**출시 게이트:**

- 카메라 권한 거부, 촬영 취소, 저장 공간 부족, 손상 이미지가 텍스트 기록을 막지 않는다.
- 500장 백업/복원 스트레스 테스트가 성공한다.
- 미디어 하나가 손상된 백업은 복원 전 경고하고 선택 정책에 따라 전체 거부 또는 안전한 부분 복원을 수행한다. 기본값은 전체 거부다.

### Task 6: 자율성 중심 성취와 로컬 회고를 추가한다

**변경 파일:**

- Create: `src/lib/achievements/definitions.ts`
- Create: `src/lib/achievements/evaluator.ts`
- Create: `src/components/profile/AchievementGrid.tsx`
- Create: `src/components/profile/LocalRecap.tsx`
- Modify: `src/lib/db/migrations.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `src/components/tabs/ProfileTab.tsx`
- Create: `tests/unit/achievements.test.ts`
- Create: `tests/unit/recap.test.ts`

**구현 원칙:**

- 성취는 `첫 기록`, `서로 다른 3개 카테고리`, `서로 다른 5개 지역`, `30일 뒤 다시 방문`, `사진과 글이 있는 기억`, `내 데이터 첫 백업`처럼 숙련과 목적을 반영한다.
- 연속 출석, 다른 사용자와의 비교, 놓치면 손해인 보상은 사용하지 않는다.
- 기존 XP의 의미를 바꾸지 않고 성취 이벤트를 별도 테이블에 저장한다.
- 사용자는 XP/성취 강조를 줄이는 `차분한 모드`를 선택할 수 있다.
- 월·연간 회고는 전부 로컬 계산하며 공유 이미지는 사용자가 명시적으로 생성한다.
- 회고 화면에만 콘셉트의 어두운 `기억 극장`, 빛나는 여정선, 종이 질감을 적용한다.

**합격 기준:**

- 같은 성취가 중복 획득되지 않는다.
- 과거 데이터에도 evaluator를 다시 실행해 정확히 소급 적용할 수 있다.
- 공유 이미지에 정밀 위치, 원문 메모, 비공개 사진이 기본 포함되지 않는다.

### Task 7: 전경 위치 확인을 사용자 흐름에 연결한다

**변경 파일:**

- Modify: `src/hooks/useGPS.ts`
- Create: `src/hooks/useVisitVerification.ts`
- Modify: `src/lib/geo/gps-tracker.ts`
- Modify: `src/lib/geo/geofence.ts`
- Modify: `src/lib/geo/visit-detector.ts`
- Modify: `src/components/places/PlaceDetailSheet.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/lib/db/migrations.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `ios/App/App/Info.plist`
- Modify: `tests/unit/gps-tracker.test.ts`
- Modify: `tests/unit/geofence.test.ts`
- Modify: `tests/unit/visit-detector.test.ts`
- Create: `tests/unit/visit-verification.test.tsx`

**구현:**

1. 기능 설명 화면에서 목적, 저장 항목, 비수집 항목, 권한 거부 후 동작을 먼저 설명한다.
2. 버튼 클릭 후 `requestPermissions -> getCurrentPosition -> findNearbyPOIs`를 한 번 실행한다.
3. 정확도가 기준보다 나쁘면 재시도 또는 수동 기록을 안내한다.
4. 반경 안에서만 `현장 확인됨`을 제안하고, 사용자가 확정해야 `createVisit`을 호출한다.
5. `verification_method`, `verification_distance_m`, `gps_accuracy_m`를 기록한다.
6. dwell 기반 자동 제안은 전경에서 사용자가 `3분 확인`을 명시적으로 시작한 경우에만 사용한다.
7. 권한 거부 상태를 Preferences에 기억하되 OS 권한 상태와 항상 재조정한다.
8. iOS에는 플러그인 요구에 맞춰 `NSLocationWhenInUseUsageDescription`과 `NSLocationAlwaysAndWhenInUseUsageDescription`을 같은 전경 사용 설명으로 선언하되, Background Modes와 실제 백그라운드 추적은 활성화하지 않는다.
9. Android는 coarse/fine 권한만 선언하고, GPS가 없어도 수동 기록이 가능하므로 GPS 하드웨어를 필수 기기 조건으로 만들지 않는다.

플랫폼 권한과 에너지 주의사항은 [공식 Geolocation 문서](https://capacitorjs.com/docs/apis/geolocation)를 기준으로 구현한다.

**현장 합격 기준:** 아래 수치는 현재 보장값이 아니라 출시 전 검증할 잠정 목표다. 먼저 최소 30회 파일럿으로 측정 절차를 고정하고, 본 시험 기준 변경 시 이유와 결과를 문서에 남긴다.

- 도심, 실내 인접, 공원, 문화재, 저가형 Android 단말에서 시험한다.
- 30초 이내 위치 확보 및 올바른 POI 확인 성공률이 90% 이상이다.
- 제안된 POI가 틀려도 사용자 확인 전에는 방문이 기록되지 않는다. 인접 POI 제안 정확도 목표는 95% 이상이다.
- 30분 전경 확인 시험에서 배터리 증가 소모가 사전 정의한 기준을 넘지 않는다.
- 권한 거부, 대략적 위치, GPS 꺼짐, 비행기 모드에서도 수동 흐름이 유지된다.

### Task 8: 실제 POI 시드와 지도 전략을 고도화한다

**변경 파일:**

- Modify: `scripts/seed-pois.mjs`
- Modify: `src/lib/poi/seed-loader.ts`
- Modify: `src/lib/poi/pois-dummy.json`
- Create: `src/lib/poi/seed-manifest.json`
- Modify: `src/components/map/MapView.tsx`
- Modify: `src/components/map/OfflineMapCanvas.tsx`
- Modify: `tests/unit/seed-script.test.ts`
- Modify: `tests/unit/seed-loader.test.ts`

**시드 규칙:**

1. `npm run seed:dummy`는 언제나 API 키 없이 결정적으로 100건을 생성한다.
2. `seed:live`만 TourAPI/국가유산 관련 키를 요구한다.
3. `seed:merge`는 소스 ID, 좌표 근접도, 정규화 이름으로 중복을 제거하고 출처를 보존한다.
4. manifest에 생성 시각, 소스, 라이선스, 레코드 수, 스키마 버전, 해시를 기록한다.
5. 앱 런타임은 외부 POI API를 호출하지 않는다.
6. 실제 시드 생성이 실패해도 마지막 검증 시드 또는 더미 시드로 빌드가 성공한다.

**지도 의사결정 스파이크:**

다음 세 옵션을 별도 프로토타입으로 비교하고, 그 전까지 `오프라인 내비게이션`을 약속하지 않는다.

| 옵션 | 장점 | 위험 |
|---|---|---|
| 현재 도식형 캔버스 강화 | 작고 빠르며 완전 오프라인 | 실제 길·지형 이해 불가 |
| MapLibre + 지역별 오프라인 벡터 패키지 | WebView 재사용, 실제 지도 가능 | 타일 용량, 스타일, 검색, 라이선스·배포 설계 필요 |
| Organic Maps 계열 네이티브 엔진 연동 | 성숙한 오프라인 검색·길찾기 | Capacitor 통합, 앱 크기, 유지보수 복잡도 매우 큼 |

**선택 기준:**

- 서울 지역 패키지와 전국 패키지의 실제 크기
- 오프라인 검색과 POI 오버레이 성능
- Android 저사양 단말과 iPhone/iPad 메모리
- 지도 라이선스와 저작자 표시
- 증분 업데이트와 손상 복구
- 콜드 스타트 2초 이내 가능성

### Task 9: 콘셉트 시각 언어를 실제 UI에 제한적으로 반영한다

**변경 파일:**

- Modify: `src/app/globals.css`
- Create: `src/components/ui/JourneyRibbon.tsx`
- Create: `src/components/ui/CategoryPin.tsx`
- Create: `src/components/ui/AchievementReveal.tsx`
- Modify: `src/components/map/POIMarker.tsx`
- Modify: `src/components/journal/MemoryTimeline.tsx`
- Modify: `src/components/profile/LocalRecap.tsx`
- Modify: `scripts/generate-play-assets.ps1`

**구현:**

- `--paso-amber`, `--paso-night`, `--paso-paper`, 카테고리 핀 색상을 디자인 토큰으로 통합한다.
- 밝은 기본 화면을 유지하고 어두운 콘셉트는 온보딩, 빈 상태, 성취, 회고에만 사용한다.
- 호박빛 선은 길 안내가 아니라 `기록의 연결`을 의미하도록 타임라인과 회고에 사용한다.
- 실제 기능 스크린샷과 생성 비전 이미지를 스토어 자산 폴더에서 명확히 분리한다.
- 텍스트 없는 핀, 색상만의 상태 구분, 과도한 빛 번짐을 피한다.

**접근성 합격 기준:**

- WCAG AA 명암비
- 200% 글자 확대에서 핵심 흐름 유지
- TalkBack/VoiceOver 레이블
- 44x44pt 이상 터치 영역
- reduced motion 지원
- 휴대폰 세로, 태블릿 세로·가로 대응

### Task 10: 비공개 테스트와 스토어 출시 게이트를 통과한다

**변경 파일:**

- Create: `docs/mobile/closed-test/product-alignment-test-missions.md`
- Create: `docs/mobile/closed-test/product-alignment-results.md`
- Create: `src/lib/diagnostics/local-diagnostic-export.ts`
- Create: `scripts/benchmark-local-data.mjs`
- Modify: `docs/mobile/store-publishing.md`
- Modify: `public/privacy.html`

**테스터 과제:**

1. 오프라인 첫 실행 후 장소를 검색하고 저장한다.
2. 태그를 만들고 지도와 탐색에서 같은 장소를 찾는다.
3. 수동 방문, 기분, 리뷰, 사진을 기록한다.
4. 앱을 강제 종료하고 기록이 남는지 확인한다.
5. 백업을 만든 뒤 테스트 데이터를 추가하고 이전 백업으로 복원한다.
6. 위치 권한 허용과 거부를 각각 시험한다.
7. `이날의 기억`과 회고 카드의 의미를 설명해 본다.

**로컬 진단 내보내기:**

- 앱·DB·스키마 버전
- 저장 모드, 레코드 수, 미디어 수·총 용량
- 마이그레이션 결과와 최근 오류 코드
- 화면별 측정 시간 요약
- 원문 메모, 리뷰 본문, 사진, 정밀 좌표는 포함하지 않는다.

**성능 측정 방법:**

- `scripts/benchmark-local-data.mjs`가 고정 시드 1,000 POI/1,000 방문을 만들고, 50회 예열 후 200회 검색의 P50/P95를 JSON으로 기록한다.
- 탭 전환은 Android 동일 AVD에서 Performance API 표식을 100회 수집한다.
- 위치 수치는 기기, OS, 환경, 시도 수, 성공·오인식·타임아웃을 표준 양식에 기록한다.
- iOS 빌드·실기기 합격은 Windows에서 주장하지 않고 macOS/Xcode 담당자가 완료한 결과를 handoff 문서에 첨부한다.

**최종 검증 명령:**

```powershell
npm test
npm run lint
npm run build
npm run build:mobile
npm run cap:sync:android
android\gradlew.bat testDebugUnitTest assembleDebug
```

**수동 검증:**

- Android 휴대폰 AVD 세로
- Android 태블릿 AVD 세로·가로
- 앱 강제 종료와 단말 재부팅 후 영속성
- 비행기 모드 전체 핵심 흐름
- 카메라/위치 권한 허용·거부·다시 묻지 않음
- 1,000 POI + 1,000 방문 + 500 사진 스트레스 데이터
- 네트워크 검사에서 기본 사용자 데이터 전송 0바이트
- iOS 프로젝트 sync, Info.plist, Xcode 실기기 테스트 handoff

## 5. 출시 전 정책 게이트

사진 또는 위치 기능을 활성화하는 릴리스마다 다음을 다시 확인한다.

- Google Play 데이터 보안 설문
- 개인정보처리방침의 기기 내 처리와 외부 전송 여부
- Android 권한과 사용 목적 문구
- iOS Privacy Nutrition Label과 usage description
- 백업 파일에 포함되는 민감 정보 안내
- 사용자가 데이터 전체 삭제와 내보내기를 수행할 수 있는 경로

`기기에서만 처리하므로 아무 정책 변경이 필요 없다`고 가정하지 않는다. 실제 플러그인 동작과 네트워크 검사를 근거로 스토어 선언을 갱신한다.

## 6. 중단 및 보류 기준

- 백업 왕복 무결성이 확보되지 않으면 사진·위치 기능 출시를 중단한다.
- WebView에서 wa-sqlite가 `memory` 모드로 폴백하면 해당 빌드 출시를 중단한다.
- 위치 확인 오인식률 또는 배터리 기준을 넘으면 기능 플래그를 끄고 수동 기록만 출시한다.
- 실제 POI 데이터의 라이선스, 출처, 갱신 정책이 불명확하면 더미/검증 시드를 유지한다.
- 오프라인 지도 엔진이 앱 크기와 저사양 성능 기준을 넘으면 도식형 캔버스를 유지한다.
- 콘셉트 이미지가 실제 기능으로 오인될 수 있으면 스토어 기능 스크린샷에서 제외한다.

## 7. 권장 실행 순서

```text
Task 0 product contract
  -> Task 1 backup safety
  -> Task 2 migrations and user state
  -> Task 3 search and place detail
  -> Task 4 timeline
  -> Task 5 photos
  -> Task 6 achievements and recap
  -> Task 7 foreground location
  -> Task 8 real POI and map spike
  -> Task 9 visual alignment
  -> Task 10 closed-test release gate
```

Task 8의 실제 API 수집은 키가 준비되는 시점에 병렬 실행할 수 있지만, 앱 빌드와 테스트는 항상 100건 더미 시드로 독립적으로 진행한다. Task 9의 공통 디자인 토큰은 Task 3부터 조금씩 적용하되, 스토어용 최종 자산은 기능 진실성이 확정된 후에만 생성한다.
