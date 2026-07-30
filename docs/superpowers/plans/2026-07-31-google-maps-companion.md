# Google Maps Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make installed Google Maps the primary place-search, save, and navigation surface while Hello! My Paso! receives explicitly shared places and keeps the private journal layer entirely on-device.

**Architecture:** Pure TypeScript modules build and validate Google Maps URLs without network resolution. A focused wa-sqlite table stores sanitized external place links independently from POIs, and an Android Capacitor plugin opens the installed Maps app and receives `text/plain` Sharesheet intents. `HomeWorkspace` orchestrates one confirmation sheet, while the existing journal controller remains the only path into visits, photos, reviews, and XP.

**Tech Stack:** Next.js 16.2.12 static export, React 19.2.4, TypeScript 5, Capacitor 8.4.2, Java/Android intents, wa-sqlite + IndexedDB, Vitest 4.1.3, Testing Library, Gradle/JUnit 4.

## Global Constraints

- Authoritative design: `docs/superpowers/specs/2026-07-31-google-maps-companion-design.md`.
- Core records, received links, photos, and coordinates stay on-device; add no backend, API route, analytics, telemetry, Google login, OAuth, or Places API.
- Preserve `output: "export"`, the `MY_PASO_BUILD_TARGET=mobile` profile, wa-sqlite, browser PWA operation, and current Capacitor shell.
- Receive only Android `ACTION_SEND` + `text/plain`; do not register `*/*`, images, files, or `SEND_MULTIPLE`.
- Never log shared text, Google Maps URLs, coordinates, notes, photos, or account-related values.
- Save nothing from an incoming share until the user sees an editable confirmation sheet and explicitly confirms.
- Never synthesize `0,0` or another fake coordinate. A link without coordinates remains an external-place draft until GPS or an explicit Maps URL coordinate is available.
- Do not claim that Paso read, wrote, synchronized, or verified a Google Maps Saved list.
- Android is the native verification target. Web and iOS use Universal HTTPS opening plus the same paste-and-confirm flow.
- iOS Share Extension signing and device testing stay outside this Windows plan and must be documented in the iOS handoff.
- Before modifying a Next.js file, read the relevant local guide under `node_modules/next/dist/docs/`.
- Use UTF-8 reads on Windows when Korean console output appears corrupted.
- Follow TDD: observe every new test fail for the intended reason before adding production behavior.
- Preserve unrelated user changes. Stop if a target file becomes dirty from another task.

---

## File Responsibility Map

### New files

| File | Single responsibility |
| --- | --- |
| `src/lib/maps/google-maps-url.ts` | Build outbound Maps URLs and normalize allowed Google Maps HTTPS URLs |
| `src/lib/maps/google-maps-share.ts` | Parse one inbound text share into an editable local draft without network access |
| `src/lib/maps/google-maps-session.ts` | Persist and restore the one pending outbound Maps round-trip |
| `src/lib/db/external-place-links.ts` | CRUD and materialization of sanitized Google Maps links |
| `src/lib/native/external-maps.ts` | Register the native plugin and open Maps with web/iOS fallback |
| `src/lib/native/share-inbox.ts` | Read, subscribe to, and acknowledge Android text shares |
| `src/components/maps/GoogleMapsPlaceSheet.tsx` | Confirm, edit, save, or cancel one received/pasted place |
| `android/app/src/main/java/com/mypaso/app/GoogleMapsShareIntentParser.java` | Reject unsupported Android share intents without Android UI dependencies |
| `android/app/src/main/java/com/mypaso/app/PasoGoogleMapsPlugin.java` | Capacitor bridge for Maps launch and incoming shares |
| `tests/unit/google-maps-url.test.ts` | Outbound URL and allowlist contract |
| `tests/unit/google-maps-share.test.ts` | Inbound text parsing and coordinate contract |
| `tests/unit/external-place-links.test.ts` | External link DB lifecycle and FK behavior |
| `tests/unit/google-maps-session.test.ts` | Round-trip session validation and expiry |
| `tests/unit/google-maps-native.test.ts` | Native plugin wrapper and web/iOS fallback |
| `tests/unit/google-maps-place-sheet.test.tsx` | Confirmation-before-persistence UI contract |
| `android/app/src/test/java/com/mypaso/app/GoogleMapsShareIntentParserTest.java` | Host-side JUnit input gate |
| `docs/mobile/google-maps-companion.md` | User flow, Android verification, iOS fallback, and troubleshooting |
| `docs/mobile/closed-test/evidence/google-maps-companion-2026-07-31.md` | Reproducible build and emulator evidence |

### Modified files

| File | Change boundary |
| --- | --- |
| `src/types/index.ts` | External link, controller input, and backup snapshot types |
| `src/lib/db/migrations.ts` | Migration v4 only |
| `src/lib/export/json-export.ts` | Snapshot 2.2-local/schema 3 export, inspection, restore |
| `src/lib/native/preferences.ts` | Add remove operation for round-trip session cleanup |
| `src/hooks/usePasoJournal.ts` | Load and mutate external links through controller methods |
| `src/components/home/HomeWorkspace.tsx` | Orchestrate share inbox, confirmation sheet, Maps session, and navigation |
| `src/components/tabs/MapTab.tsx` | Memory-map filtering, outbound Maps actions, paste entry |
| `src/components/tabs/ExploreTab.tsx` | Outbound Maps actions from place detail |
| `src/components/tabs/JournalTab.tsx` | Resume card and coordinate-less external drafts |
| `src/components/tabs/ProfileTab.tsx` | Backup sensitivity copy |
| `android/app/src/main/AndroidManifest.xml` | Narrow text share intent filter |
| `android/app/src/main/java/com/mypaso/app/MainActivity.java` | Register plugin and retain warm-start intent |
| `tests/unit/sqlite.test.ts` | Fresh v4 and v3-to-v4 migration coverage |
| `tests/unit/json-export.test.ts` | New snapshot, legacy, invalid reference, rollback coverage |
| `tests/unit/native-config.test.ts` | Static Android registration and manifest assertions |
| `tests/unit/native-wrappers.test.ts` | Preferences remove mock/contract |
| `tests/unit/home-workspace.test.tsx` | Cold/warm share orchestration and session restore |
| `tests/unit/map-tab.test.tsx` | Memory-map and outbound action UI |
| `tests/unit/explore-tab.test.tsx` | Place-detail Maps actions |
| `tests/unit/journal-tab.test.tsx` | Resume card and draft actions |
| `public/privacy.html` | User-initiated cross-app share disclosure |
| `README.md` and `README.en.md` | Product role and limitations |
| `docs/mobile/ios-handoff.md` | Universal Link fallback and native Share Extension boundary |

### Deleted file

| File | Reason |
| --- | --- |
| `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` | Wrong package template replaced by real parser tests |

---

### Task 1: Pure Google Maps URL And Share Parsing

**Files:**
- Create: `src/lib/maps/google-maps-url.ts`
- Create: `src/lib/maps/google-maps-share.ts`
- Create: `tests/unit/google-maps-url.test.ts`
- Create: `tests/unit/google-maps-share.test.ts`

**Interfaces:**
- Produces:

```ts
export type GoogleMapsAction = "view" | "directions";

export type GoogleMapsLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

export const GOOGLE_MAPS_HOME_URL = "https://www.google.com/maps";

export function buildGoogleMapsUrl(
  action: GoogleMapsAction,
  place: GoogleMapsLocation,
): string;

export function normalizeGoogleMapsUrl(input: string): string;

export type ParsedGoogleMapsShare = {
  displayName: string;
  externalUrl: string;
  latitude?: number;
  longitude?: number;
};

export class GoogleMapsShareError extends Error {
  code: "too_large" | "missing_url" | "unsupported_url";

  constructor(
    code: "too_large" | "missing_url" | "unsupported_url",
    message: string,
  );
}

export function parseGoogleMapsShareText(
  input: string,
): ParsedGoogleMapsShare;
```

- Consumes: no project state and no network.

- [ ] **Step 1: Write outbound URL tests**

Add assertions that use exact coordinates, not a name-only global search:

```ts
expect(
  buildGoogleMapsUrl("view", {
    name: "경복궁",
    latitude: 37.579617,
    longitude: 126.977041,
  }),
).toBe(
  "https://www.google.com/maps/search/?api=1&query=37.579617%2C126.977041",
);

expect(
  buildGoogleMapsUrl("directions", {
    name: "경복궁",
    latitude: 37.579617,
    longitude: 126.977041,
  }),
).toBe(
  "https://www.google.com/maps/dir/?api=1&destination=37.579617%2C126.977041",
);
```

Also assert rejection of non-finite and out-of-range coordinates.

- [ ] **Step 2: Run the outbound tests and observe the missing-module failure**

Run:

```powershell
npx vitest run tests/unit/google-maps-url.test.ts
```

Expected: FAIL because `@/lib/maps/google-maps-url` does not exist.

- [ ] **Step 3: Implement the outbound builder and strict URL normalizer**

Use these constants and defensive checks:

```ts
const ALLOWED_HOSTS = new Set([
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

const ALLOWED_QUERY_KEYS = new Set([
  "api",
  "query",
  "query_place_id",
  "destination",
  "destination_place_id",
  "origin",
  "origin_place_id",
  "travelmode",
  "dir_action",
  "map_action",
  "basemap",
  "zoom",
  "layer",
  "q",
  "ll",
  "saddr",
  "daddr",
  "center",
  "ftid",
  "cid",
]);

function assertCoordinate(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("유효한 지도 좌표가 필요합니다.");
  }
}
```

`normalizeGoogleMapsUrl()` must:

1. reject values longer than 2,048 characters;
2. parse with the standard `URL` constructor;
3. require `https:`, no username/password, and an exact allowlisted hostname;
4. require `/maps` for `www.google.com`, `maps.google.com`, and `goo.gl`;
5. remove the fragment and every query parameter not in `ALLOWED_QUERY_KEYS`;
6. return the normalized URL without making a request.

- [ ] **Step 4: Run outbound tests**

Run:

```powershell
npx vitest run tests/unit/google-maps-url.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write inbound share parser tests**

Cover all accepted coordinate forms and hostile inputs:

```ts
expect(
  parseGoogleMapsShareText(
    "경복궁\nhttps://www.google.com/maps/@37.579617,126.977041,17z?entry=ttu",
  ),
).toEqual({
  displayName: "경복궁",
  externalUrl:
    "https://www.google.com/maps/@37.579617,126.977041,17z",
  latitude: 37.579617,
  longitude: 126.977041,
});

expect(
  parseGoogleMapsShareText(
    "다음 여행지 https://maps.app.goo.gl/AbCdEf123",
  ),
).toEqual({
  displayName: "다음 여행지",
  externalUrl: "https://maps.app.goo.gl/AbCdEf123",
});

expect(() =>
  parseGoogleMapsShareText("https://google.com.evil.example/maps/place/x"),
).toThrowError(expect.objectContaining({ code: "unsupported_url" }));
```

Also cover `query=lat,lng`, `destination=lat,lng`, `!3dLAT!4dLNG`, blank input, 8 KiB overflow, a non-HTTPS URL, URL userinfo, control characters, a missing name, and a longitude outside `-180..180`.

- [ ] **Step 6: Run the parser tests and observe the missing-module failure**

Run:

```powershell
npx vitest run tests/unit/google-maps-share.test.ts
```

Expected: FAIL because `@/lib/maps/google-maps-share` does not exist.

- [ ] **Step 7: Implement the local parser**

Use one URL match and never resolve it:

```ts
const MAX_SHARE_TEXT_LENGTH = 8 * 1024;
const MAX_DISPLAY_NAME_LENGTH = 160;
const URL_PATTERN = /https:\/\/[^\s<>"']+/i;

export function parseGoogleMapsShareText(
  input: string,
): ParsedGoogleMapsShare {
  if (input.length > MAX_SHARE_TEXT_LENGTH) {
    throw new GoogleMapsShareError(
      "too_large",
      "공유 내용이 너무 커서 안전하게 처리하지 않았습니다.",
    );
  }

  const match = input.match(URL_PATTERN);
  if (!match) {
    throw new GoogleMapsShareError(
      "missing_url",
      "Google Maps 링크를 찾지 못했습니다.",
    );
  }

  let externalUrl: string;
  try {
    externalUrl = normalizeGoogleMapsUrl(
      match[0].replace(/[)\],.!?]+$/u, ""),
    );
  } catch {
    throw new GoogleMapsShareError(
      "unsupported_url",
      "지원하는 Google Maps 링크가 아닙니다.",
    );
  }

  const displayName = input
    .replace(match[0], " ")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .trim()
    .split(/\r?\n/u)[0]
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);

  return {
    displayName,
    externalUrl,
    ...extractExplicitCoordinates(externalUrl),
  };
}
```

`extractExplicitCoordinates()` must inspect, in order, `@lat,lng`, `!3dLAT!4dLNG`, and the decoded `query`, `destination`, `q`, `ll`, or `daddr` value. Return no coordinates when either number is invalid.

Implement the error constructor exactly once:

```ts
constructor(
  code: GoogleMapsShareError["code"],
  message: string,
) {
  super(message);
  this.name = "GoogleMapsShareError";
  this.code = code;
}
```

- [ ] **Step 8: Run both pure-module suites**

Run:

```powershell
npx vitest run tests/unit/google-maps-url.test.ts tests/unit/google-maps-share.test.ts
```

Expected: PASS with no network mocks because neither module performs I/O.

- [ ] **Step 9: Commit Task 1**

```powershell
git add -- src/lib/maps/google-maps-url.ts src/lib/maps/google-maps-share.ts tests/unit/google-maps-url.test.ts tests/unit/google-maps-share.test.ts
git commit -m "feat: add safe Google Maps link parsing"
```

---

### Task 2: External Place Link Migration And Repository

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/db/migrations.ts`
- Create: `src/lib/db/external-place-links.ts`
- Modify: `tests/unit/sqlite.test.ts`
- Create: `tests/unit/external-place-links.test.ts`

**Interfaces:**
- Consumes: `normalizeGoogleMapsUrl()` from Task 1, `PasoDatabase`, `POI`, and `withImmediateTransaction()`.
- Produces:

```ts
export type ExternalPlaceLink = {
  id: string;
  provider: "google_maps";
  external_url: string;
  display_name: string;
  latitude?: number;
  longitude?: number;
  poi_id?: string;
  created_at: string;
  updated_at: string;
};

export type SaveExternalPlaceLinkInput = {
  externalUrl: string;
  displayName: string;
  latitude?: number;
  longitude?: number;
};

export async function getExternalPlaceLinks(
  database: PasoDatabase,
): Promise<ExternalPlaceLink[]>;

export async function saveExternalPlaceLink(
  database: PasoDatabase,
  input: SaveExternalPlaceLinkInput,
): Promise<ExternalPlaceLink>;

export async function deleteExternalPlaceLink(
  database: PasoDatabase,
  linkId: string,
): Promise<void>;

export async function materializeExternalPlaceLink(
  database: PasoDatabase,
  linkId: string,
  coordinates: { latitude: number; longitude: number },
): Promise<{ link: ExternalPlaceLink; poi: POI }>;
```

- [ ] **Step 1: Add failing fresh-install and upgrade migration tests**

The fresh test must assert these columns:

```ts
expect(columns).toEqual([
  "id",
  "provider",
  "external_url",
  "display_name",
  "latitude",
  "longitude",
  "poi_id",
  "created_at",
  "updated_at",
]);
```

The upgrade test must create a database with `schema_migrations` versions 1, 2, and 3, run `runMigrations()`, and assert version 4 appears exactly once without changing an existing visit.

- [ ] **Step 2: Run migration tests and observe the missing table failure**

Run:

```powershell
npx vitest run tests/unit/sqlite.test.ts
```

Expected: FAIL because `external_place_links` is absent.

- [ ] **Step 3: Add migration v4 and external-link types**

Add exactly this schema as the fourth migration:

```sql
CREATE TABLE IF NOT EXISTS external_place_links (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'google_maps'),
  external_url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  poi_id TEXT REFERENCES pois(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, external_url)
);

CREATE INDEX IF NOT EXISTS idx_external_place_links_poi
  ON external_place_links(poi_id);
```

Append `{ version: 4, sql: EXTERNAL_PLACE_LINK_SCHEMA }` to `MIGRATIONS`. Do not alter migrations 1-3.

- [ ] **Step 4: Run migration tests**

Run:

```powershell
npx vitest run tests/unit/sqlite.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing repository tests**

The suite must verify:

```ts
const first = await saveExternalPlaceLink(database, {
  externalUrl: "https://maps.app.goo.gl/AbCdEf123",
  displayName: "교토의 찻집",
});

const updated = await saveExternalPlaceLink(database, {
  externalUrl: "https://maps.app.goo.gl/AbCdEf123",
  displayName: "교토 찻집",
  latitude: 35.0116,
  longitude: 135.7681,
});

expect(updated.id).toBe(first.id);
expect(await getExternalPlaceLinks(database)).toHaveLength(1);
```

Also assert:

- whitespace-only names are rejected;
- invalid coordinates and non-Google URLs are rejected;
- coordinate-less links do not insert into `pois`;
- materialization inserts a `custom` POI with `source='google_maps_share'` and connects `poi_id`;
- deleting the POI sets the external link `poi_id` to null;
- deleting the external link does not delete the POI or visits.

- [ ] **Step 6: Run repository tests and observe the missing-module failure**

Run:

```powershell
npx vitest run tests/unit/external-place-links.test.ts
```

Expected: FAIL because `@/lib/db/external-place-links` does not exist.

- [ ] **Step 7: Implement repository row mapping and URL upsert**

Use a private mapper and a transaction-safe upsert:

```ts
const UPSERT_EXTERNAL_LINK = `
  INSERT INTO external_place_links (
    id, provider, external_url, display_name, latitude, longitude
  ) VALUES (?, 'google_maps', ?, ?, ?, ?)
  ON CONFLICT(provider, external_url) DO UPDATE SET
    display_name = excluded.display_name,
    latitude = COALESCE(excluded.latitude, external_place_links.latitude),
    longitude = COALESCE(excluded.longitude, external_place_links.longitude),
    updated_at = datetime('now');
`;
```

Generate IDs as `external-${crypto.randomUUID()}` with the same timestamp/random fallback style used in `queries.ts`. After the upsert, select by `(provider, external_url)` and return the mapped row.

- [ ] **Step 8: Implement materialization without fake coordinates**

Inside `withImmediateTransaction()`:

1. select the external link or throw `Google Maps 장소 연결을 찾지 못했습니다.`;
2. validate the supplied coordinates;
3. reuse its existing POI when `poi_id` is present;
4. otherwise insert a POI with `category='custom'`, `geofence_radius_m=50`, empty `region/district`, `source='google_maps_share'`, and `base_xp=10`;
5. upsert `poi_user_state` with `is_saved=1` so the confirmed local place stays visible and sorts ahead of untouched seed rows;
6. update the link `poi_id`, latitude, longitude, and `updated_at`;
7. return the linked row and POI.

- [ ] **Step 9: Run DB suites**

Run:

```powershell
npx vitest run tests/unit/sqlite.test.ts tests/unit/external-place-links.test.ts tests/unit/queries.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```powershell
git add -- src/types/index.ts src/lib/db/migrations.ts src/lib/db/external-place-links.ts tests/unit/sqlite.test.ts tests/unit/external-place-links.test.ts
git commit -m "feat: persist external Google Maps places"
```

---

### Task 3: Backup, Inspection, Restore, And Rollback

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/export/json-export.ts`
- Modify: `tests/unit/json-export.test.ts`

**Interfaces:**
- Consumes: `ExternalPlaceLink` and `getExternalPlaceLinks()` from Task 2.
- Produces:

```ts
export interface PasoSnapshot {
  // existing fields remain
  external_place_links?: ExternalPlaceLink[];
  record_counts?: {
    // existing counts remain
    external_place_links?: number;
  };
}
```

- Snapshot version: `2.2-local`.
- Snapshot schema version: `3`.
- Legacy read versions: `2.1-local`, `2.0-local`, `0.2.0-local`.

- [ ] **Step 1: Write failing export and inspection tests**

Add one linked and one coordinate-less external link, export, and assert:

```ts
expect(snapshot.version).toBe("2.2-local");
expect(snapshot.schema_version).toBe(3);
expect(snapshot.external_place_links).toHaveLength(2);
expect(snapshot.record_counts?.external_place_links).toBe(2);
expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
```

Add a legacy `2.1-local` fixture without `external_place_links` and assert it remains valid with an empty restored link list.

- [ ] **Step 2: Write failing invalid-reference and rollback tests**

Cover both safety conditions:

```ts
invalid.external_place_links = [
  {
    id: "external-bad",
    provider: "google_maps",
    external_url: "https://maps.app.goo.gl/AbCdEf123",
    display_name: "잘못된 연결",
    poi_id: "missing-poi",
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  },
];
```

Inspection must reject it before changing the target DB. A forced restore failure after deletion must roll back and preserve the target DB's pre-existing external link.

- [ ] **Step 3: Run snapshot tests and observe version/count failures**

Run:

```powershell
npx vitest run tests/unit/json-export.test.ts
```

Expected: FAIL because the exporter still emits `2.1-local` and omits external links.

- [ ] **Step 4: Extend export and record counts**

Change constants:

```ts
const SNAPSHOT_VERSION = "2.2-local";
const SCHEMA_VERSION = 3;
const LEGACY_SNAPSHOT_VERSIONS = new Set([
  "2.1-local",
  "2.0-local",
  "0.2.0-local",
]);
```

Load external links alongside existing records, include them in the snapshot before calculating the checksum, and include `external_place_links` in inspection counts.

- [ ] **Step 5: Add strict external-link inspection**

For every new-format link:

- require a unique non-empty `id`;
- require `provider === "google_maps"`;
- require a non-empty `display_name`;
- normalize and compare `external_url` using Task 1;
- require finite in-range coordinates when present;
- require latitude and longitude to be present together;
- require any `poi_id` to exist in snapshot `pois`;
- reject duplicate `(provider, external_url)` pairs.

For legacy snapshots, missing `external_place_links` means `[]`, not an error.

- [ ] **Step 6: Restore in FK-safe order**

In the restore transaction:

```sql
DELETE FROM external_place_links;
DELETE FROM reviews;
DELETE FROM visits;
DELETE FROM xp_log;
DELETE FROM poi_tags;
DELETE FROM tags;
DELETE FROM poi_user_state;
DELETE FROM pois;
```

Restore POIs first, then external links, then visits/reviews/XP. Bind `poi_id` as null when absent. Extend post-restore verification with the external-link count and references.

- [ ] **Step 7: Run snapshot and DB suites**

Run:

```powershell
npx vitest run tests/unit/json-export.test.ts tests/unit/external-place-links.test.ts tests/unit/sqlite.test.ts
```

Expected: PASS, including legacy import and rollback.

- [ ] **Step 8: Commit Task 3**

```powershell
git add -- src/types/index.ts src/lib/export/json-export.ts tests/unit/json-export.test.ts
git commit -m "feat: include map links in verified backups"
```

---

### Task 4: TypeScript Native Bridge, Web Fallback, And Round-Trip Session

**Files:**
- Modify: `src/lib/native/preferences.ts`
- Create: `src/lib/native/external-maps.ts`
- Create: `src/lib/native/share-inbox.ts`
- Create: `src/lib/maps/google-maps-session.ts`
- Modify: `tests/unit/native-wrappers.test.ts`
- Create: `tests/unit/google-maps-native.test.ts`
- Create: `tests/unit/google-maps-session.test.ts`

**Interfaces:**
- Consumes: `normalizeGoogleMapsUrl()`, `isNative()`, `getPlatform()`, Preferences.
- Produces:

```ts
export type IncomingShare = {
  text: string;
  receivedAt: string;
};

export type ExternalMapsTarget = "google-maps" | "browser";

export async function openGoogleMaps(
  url: string,
): Promise<{ target: ExternalMapsTarget }>;

export async function getPendingShare(): Promise<IncomingShare | null>;

export async function acknowledgePendingShare(): Promise<void>;

export async function addIncomingShareListener(
  listener: (share: IncomingShare) => void,
): Promise<{ remove: () => Promise<void> }>;

export type GoogleMapsSession = {
  poiId: string;
  action: "view" | "directions";
  startedAt: string;
};

export async function saveGoogleMapsSession(
  session: GoogleMapsSession,
): Promise<void>;

export async function loadGoogleMapsSession(
  now?: Date,
): Promise<GoogleMapsSession | null>;

export async function clearGoogleMapsSession(): Promise<void>;
```

- [ ] **Step 1: Add failing Preferences remove and session tests**

Tests must assert web localStorage removal, native `Preferences.remove({ key })`, valid session round-trip, malformed JSON cleanup, and expiry after 24 hours.

```ts
await saveGoogleMapsSession({
  poiId: "poi-1",
  action: "view",
  startedAt: "2026-07-31T00:00:00.000Z",
});

await expect(
  loadGoogleMapsSession(new Date("2026-07-31T01:00:00.000Z")),
).resolves.toEqual(expect.objectContaining({ poiId: "poi-1" }));
```

- [ ] **Step 2: Run session tests and observe missing exports**

Run:

```powershell
npx vitest run tests/unit/google-maps-session.test.ts tests/unit/native-wrappers.test.ts
```

Expected: FAIL because session helpers and `removeSetting()` do not exist.

- [ ] **Step 3: Implement removal and validated session storage**

Add:

```ts
export async function removeSetting(key: string) {
  if (isNative()) {
    await Preferences.remove({ key });
    return;
  }

  globalThis.localStorage?.removeItem(key);
}
```

Use the key `google-maps-resume-session`. `loadGoogleMapsSession()` must validate exact action values, a non-empty `poiId`, a valid timestamp, and the 24-hour age. It must clear invalid or expired values.

- [ ] **Step 4: Write failing bridge tests**

Mock `registerPlugin()` to expose a `PasoGoogleMaps` fake. Verify:

- Android native opening calls `openGoogleMaps({ url: normalized })`;
- plugin result `google-maps` is returned;
- web and iOS do not call the plugin and open the normalized HTTPS URL;
- blocked `window.open()` falls back to `location.assign()`;
- `getPendingShare()` maps an empty native response to null;
- web/iOS pending share returns null;
- listener removal is idempotent.

- [ ] **Step 5: Run bridge tests and observe missing modules**

Run:

```powershell
npx vitest run tests/unit/google-maps-native.test.ts
```

Expected: FAIL because the bridge files do not exist.

- [ ] **Step 6: Register the raw Capacitor plugin**

Use this raw contract in `external-maps.ts`:

```ts
type PendingShareResult = { share?: IncomingShare };

interface PasoGoogleMapsPlugin {
  openGoogleMaps(options: {
    url: string;
  }): Promise<{ target: ExternalMapsTarget }>;
  getPendingShare(): Promise<PendingShareResult>;
  acknowledgePendingShare(): Promise<void>;
  addListener(
    eventName: "shareReceived",
    listener: (share: IncomingShare) => void,
  ): Promise<PluginListenerHandle>;
}

export const PasoGoogleMaps = registerPlugin<PasoGoogleMapsPlugin>(
  "PasoGoogleMaps",
);
```

Only call the plugin when `isNative() && getPlatform() === "android"`. The public functions in `share-inbox.ts` translate the raw shape into the interfaces above.

- [ ] **Step 7: Implement web/iOS URL opening**

Normalize before every launch. On web/iOS:

```ts
const opened = globalThis.open?.(
  normalizedUrl,
  "_blank",
  "noopener,noreferrer",
);

if (!opened) {
  globalThis.location?.assign(normalizedUrl);
}

return { target: "browser" };
```

Do not inspect installed app lists. iOS Universal Links decide whether Maps or the browser handles the URL.

- [ ] **Step 8: Run native/session suites**

Run:

```powershell
npx vitest run tests/unit/google-maps-native.test.ts tests/unit/google-maps-session.test.ts tests/unit/native-wrappers.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```powershell
git add -- src/lib/native/preferences.ts src/lib/native/external-maps.ts src/lib/native/share-inbox.ts src/lib/maps/google-maps-session.ts tests/unit/native-wrappers.test.ts tests/unit/google-maps-native.test.ts tests/unit/google-maps-session.test.ts
git commit -m "feat: bridge Google Maps app round trips"
```

---

### Task 5: Android Capacitor Plugin And Sharesheet Target

**Files:**
- Create: `android/app/src/main/java/com/mypaso/app/GoogleMapsShareIntentParser.java`
- Create: `android/app/src/main/java/com/mypaso/app/PasoGoogleMapsPlugin.java`
- Modify: `android/app/src/main/java/com/mypaso/app/MainActivity.java`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Delete: `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`
- Create: `android/app/src/test/java/com/mypaso/app/GoogleMapsShareIntentParserTest.java`
- Modify: `tests/unit/native-config.test.ts`

**Interfaces:**
- Consumes: the raw `PasoGoogleMaps` plugin name and method/event names from Task 4.
- Produces:

```java
@CapacitorPlugin(name = "PasoGoogleMaps")
public class PasoGoogleMapsPlugin extends Plugin {
    @Override
    protected void handleOnNewIntent(Intent intent);

    @PluginMethod
    public void getPendingShare(PluginCall call);

    @PluginMethod
    public void acknowledgePendingShare(PluginCall call);

    @PluginMethod
    public void openGoogleMaps(PluginCall call);
}
```

- [ ] **Step 1: Write the pure-Java intent gate tests**

Test this exact matrix without constructing Android `Intent` objects:

```java
assertEquals(
    "장소 https://maps.app.goo.gl/AbCdEf123",
    GoogleMapsShareIntentParser.accept(
        "android.intent.action.SEND",
        "text/plain",
        "장소 https://maps.app.goo.gl/AbCdEf123"
    )
);

assertNull(GoogleMapsShareIntentParser.accept(
    "android.intent.action.SEND_MULTIPLE",
    "text/plain",
    "text"
));
assertNull(GoogleMapsShareIntentParser.accept(
    "android.intent.action.SEND",
    "image/png",
    "text"
));
```

Also reject null, blank, and strings over 8 KiB. Preserve accepted text without logging or URL parsing.

- [ ] **Step 2: Run Android unit tests and observe the missing-class failure**

Use a short drive path to avoid Windows Gradle path limits:

```powershell
subst P: 'C:\Users\sinmb\workspace\Hello! My Paso! — Local-First Addendum\my-paso'
Push-Location P:\android
.\gradlew.bat :app:testDebugUnitTest --no-daemon --console=plain
Pop-Location
```

Expected: FAIL because `GoogleMapsShareIntentParser` is absent.

- [ ] **Step 3: Implement the pure-Java gate**

```java
final class GoogleMapsShareIntentParser {
    static final int MAX_TEXT_LENGTH = 8 * 1024;

    private GoogleMapsShareIntentParser() {}

    static String accept(
        String action,
        String mimeType,
        String text
    ) {
        if (!"android.intent.action.SEND".equals(action)) return null;
        if (!"text/plain".equals(mimeType)) return null;
        if (text == null || text.trim().isEmpty()) return null;
        if (text.length() > MAX_TEXT_LENGTH) return null;
        return text;
    }
}
```

- [ ] **Step 4: Write failing static native configuration tests**

In `native-config.test.ts`, read files as UTF-8 and assert:

- Manifest has one SEND filter with DEFAULT and `text/plain`;
- it has no `SEND_MULTIPLE` or `*/*`;
- MainActivity calls `registerPlugin(PasoGoogleMapsPlugin.class)` before `super.onCreate`;
- `onNewIntent()` calls `setIntent(intent)` before `super.onNewIntent(intent)`;
- Java annotation name is `PasoGoogleMaps`;
- Java contains no `Log.`, `System.out`, or raw URL in reject messages.

- [ ] **Step 5: Run static tests and observe missing registration**

Run:

```powershell
npx vitest run tests/unit/native-config.test.ts
```

Expected: FAIL because Manifest, MainActivity, and plugin are not updated.

- [ ] **Step 6: Add the narrow Manifest filter**

Add a second filter under the existing exported `singleTask` MainActivity:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

Do not modify the launcher filter.

- [ ] **Step 7: Register the plugin and retain warm intents**

In MainActivity:

```java
@Override
protected void onCreate(Bundle savedInstanceState) {
    setTheme(R.style.AppTheme_NoActionBar);
    EdgeToEdge.enable(this);
    registerPlugin(PasoGoogleMapsPlugin.class);
    super.onCreate(savedInstanceState);
}

@Override
protected void onNewIntent(Intent intent) {
    setIntent(intent);
    super.onNewIntent(intent);
}
```

Do not parse or dispatch the intent in MainActivity. Capacitor 8 dispatches cold and warm intents to every registered plugin.

- [ ] **Step 8: Implement pending-share delivery**

`handleOnNewIntent()` must call the pure gate, then build:

```java
JSObject payload = new JSObject();
payload.put("text", acceptedText);
payload.put("receivedAt", utcTimestamp());
pendingShare = payload;
notifyListeners("shareReceived", payload, true);
```

`getPendingShare()` resolves `{ "share": pendingShare }` when present and `{}` otherwise.

`acknowledgePendingShare()` must clear `pendingShare` and sanitize the Activity's current SEND intent:

```java
Intent current = getActivity().getIntent();
if (current != null && Intent.ACTION_SEND.equals(current.getAction())) {
    current.removeExtra(Intent.EXTRA_TEXT);
    current.setAction(null);
    getActivity().setIntent(current);
}
call.resolve();
```

- [ ] **Step 9: Implement installed Maps launch with defense in depth**

Require a non-empty HTTPS URL. Try:

```java
Intent mapsIntent = new Intent(Intent.ACTION_VIEW, uri);
mapsIntent.setPackage("com.google.android.apps.maps");
getActivity().startActivity(mapsIntent);
```

On `ActivityNotFoundException`, retry the same URI without a package and resolve `{ target: "browser" }`. If both fail, reject with `지도를 열 수 없습니다.` and never include the URL in the error.

- [ ] **Step 10: Run Java and static tests**

Run:

```powershell
Push-Location P:\android
.\gradlew.bat :app:testDebugUnitTest --no-daemon --console=plain
Pop-Location
npx vitest run tests/unit/native-config.test.ts tests/unit/google-maps-native.test.ts
```

Expected: PASS.

- [ ] **Step 11: Remove the temporary subst drive**

```powershell
subst P: /D
```

Expected: drive `P:` is removed; repository files are unchanged.

- [ ] **Step 12: Commit Task 5**

```powershell
git add -- android/app/src/main/AndroidManifest.xml android/app/src/main/java/com/mypaso/app/MainActivity.java android/app/src/main/java/com/mypaso/app/GoogleMapsShareIntentParser.java android/app/src/main/java/com/mypaso/app/PasoGoogleMapsPlugin.java android/app/src/test/java/com/mypaso/app/GoogleMapsShareIntentParserTest.java tests/unit/native-config.test.ts
git add -u -- android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java
git commit -m "feat: receive Google Maps shares on Android"
```

---

### Task 6: Journal Controller And Editable Confirmation Sheet

**Files:**
- Modify: `src/hooks/usePasoJournal.ts`
- Modify: `src/types/index.ts`
- Create: `src/components/maps/GoogleMapsPlaceSheet.tsx`
- Create: `tests/unit/google-maps-place-sheet.test.tsx`
- Modify: `tests/unit/queries.test.ts`

**Interfaces:**
- Consumes: Task 1 parser type and Task 2 repository.
- Produces controller fields:

```ts
externalPlaceLinks: ExternalPlaceLink[];

saveExternalPlaceDraft(
  input: SaveExternalPlaceLinkInput,
): Promise<ExternalPlaceLink>;

deleteExternalPlaceDraft(linkId: string): Promise<void>;

prepareExternalPlaceVisit(
  linkId: string,
  coordinates: { latitude: number; longitude: number },
): Promise<POI>;
```

- Produces component props:

```ts
type GoogleMapsPlaceSheetProps = {
  place: ParsedGoogleMapsShare | null;
  canPersist: boolean;
  busy: boolean;
  onSaveDraft: (place: ParsedGoogleMapsShare) => Promise<void>;
  onPrepareVisit: (place: ParsedGoogleMapsShare) => Promise<void>;
  onOpenOriginal: (url: string) => Promise<void>;
  onCancel: () => void;
};
```

- [ ] **Step 1: Write failing controller refresh tests**

Extend the journal hook/query test setup to assert:

1. initial snapshot includes external links;
2. save, delete, and materialize each refresh the controller;
3. materialization returns a POI and selects it;
4. memory-mode controller rejects persistence methods with the existing safe-storage error.

- [ ] **Step 2: Run the controller tests and observe missing methods**

Run:

```powershell
npx vitest run tests/unit/queries.test.ts
```

Expected: FAIL because the controller does not expose external links.

- [ ] **Step 3: Extend controller state and mutations**

Add `externalPlaceLinks` to the empty state and every snapshot refresh. Mutations must call Task 2 functions, refresh, and keep a selected POI only when it still exists.

For `prepareExternalPlaceVisit()`:

```ts
const { poi } = await materializeExternalPlaceLink(
  database,
  linkId,
  coordinates,
);
await refreshSnapshot(database);
setState((current) => ({ ...current, selectedPoiId: poi.id }));
return poi;
```

- [ ] **Step 4: Write failing confirmation sheet tests**

Cover:

- no dialog when `place` is null;
- editable name is initialized from parsed share;
- save and record buttons stay disabled when the name is blank;
- `canPersist=false` disables both persistence actions but keeps `Google Maps에서 다시 열기`;
- changing the name passes the edited value;
- coordinate-less input displays `현재 위치가 필요합니다`;
- cancel calls only `onCancel`;
- no callback runs during render.

- [ ] **Step 5: Run sheet tests and observe the missing-component failure**

Run:

```powershell
npx vitest run tests/unit/google-maps-place-sheet.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 6: Implement the controlled confirmation sheet**

Use a native `<dialog open>`-style accessible overlay or the project's existing fixed overlay pattern. Required labels:

```text
Google Maps에서 받은 장소
장소 이름
좌표 확인됨
현재 위치가 필요합니다
지금 방문 기록
나중에 기록
Google Maps에서 다시 열기
취소
```

Keep a local editable name, trim it on callback, and reset it whenever `place.externalUrl` changes. The component must never access the DB, GPS, or native plugin directly.

- [ ] **Step 7: Run focused UI/controller suites**

Run:

```powershell
npx vitest run tests/unit/google-maps-place-sheet.test.tsx tests/unit/queries.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```powershell
git add -- src/hooks/usePasoJournal.ts src/types/index.ts src/components/maps/GoogleMapsPlaceSheet.tsx tests/unit/google-maps-place-sheet.test.tsx tests/unit/queries.test.ts
git commit -m "feat: confirm shared places before journaling"
```

---

### Task 7: Incoming Share And Paste Orchestration

**Files:**
- Modify: `src/components/home/HomeWorkspace.tsx`
- Modify: `src/components/tabs/MapTab.tsx`
- Modify: `tests/unit/home-workspace.test.tsx`
- Modify: `tests/unit/map-tab.test.tsx`

**Interfaces:**
- Consumes: `getPendingShare()`, `addIncomingShareListener()`, `acknowledgePendingShare()`, `parseGoogleMapsShareText()`, `GoogleMapsPlaceSheet`, journal controller methods.
- Produces:

```ts
async function acceptIncomingShare(share: IncomingShare): Promise<void>;
function openPasteSheet(): void;
```

- [ ] **Step 1: Read the local Next.js client-component guide**

Run:

```powershell
rg -n "use client|Client Components|useEffect" node_modules/next/dist/docs
```

Open the most relevant local page completely before editing `HomeWorkspace.tsx`. Record no generated output in the repository.

- [ ] **Step 2: Write failing cold/warm share tests**

Mock inbox functions and assert:

- the pending cold-start share is parsed exactly once;
- a warm listener share replaces no active sheet until the current one closes;
- duplicate `{receivedAt,text}` delivery is ignored;
- a valid share opens the editable sheet, then acknowledges native delivery;
- an invalid/non-Google share shows an error toast, acknowledges it, and stores nothing;
- cancel stores nothing;
- `나중에 기록` calls `saveExternalPlaceDraft`;
- `지금 방문 기록` uses parsed coordinates when present;
- coordinate-less `지금 방문 기록` requests foreground permission/position and never creates a fake coordinate;
- permission denial leaves the draft unsaved and the sheet open.

- [ ] **Step 3: Write the failing paste-entry test**

In `map-tab.test.tsx`, click `Google Maps 링크 붙여넣기` and assert its callback is invoked. In `home-workspace.test.tsx`, paste a Maps URL plus name and assert it enters the same sheet path as an Android share.

- [ ] **Step 4: Run focused tests and observe missing orchestration**

Run:

```powershell
npx vitest run tests/unit/home-workspace.test.tsx tests/unit/map-tab.test.tsx
```

Expected: FAIL because inbox effects, sheet state, and paste callback are absent.

- [ ] **Step 5: Add one inbox effect with explicit deduplication**

Use refs for processed delivery keys and one in-memory pending slot for a share received while a sheet is already open:

```ts
const deliveryKey = `${share.receivedAt}\u001f${share.text}`;
if (processedSharesRef.current.has(deliveryKey)) return;
processedSharesRef.current.add(deliveryKey);
```

The effect must:

1. subscribe;
2. read the pending share;
3. remove the listener on unmount;
4. avoid state updates after unmount;
5. never log the share.

After a valid parse is committed to React state, acknowledge it from an effect keyed to that delivery. If another share occupies the pending slot, show `새 장소 공유 1개가 대기 중입니다` so receipt is visible before acknowledgment. After a parse error is presented through a generic toast, acknowledge it. Acknowledgment means transport consumed, not journal saved.

- [ ] **Step 6: Route both Android share and paste through one parser**

`MapTab` exposes `onPasteGoogleMapsLink(text: string)`. Use a small controlled input sheet in `HomeWorkspace` or reuse `GoogleMapsPlaceSheet` after parsing. Do not add a second validation implementation.

- [ ] **Step 7: Implement explicit confirmation actions**

- `onSaveDraft`: save the sanitized URL/name/optional coordinates and close.
- `onPrepareVisit` with parsed coordinates: save draft, materialize, select POI, switch to Journal, close.
- `onPrepareVisit` without coordinates: lazily request location, save/materialize only on success, select POI, switch to Journal.
- `onOpenOriginal`: call `openGoogleMaps()` without persistence.
- `onCancel`: clear only UI state.

- [ ] **Step 8: Run focused and regression UI tests**

Run:

```powershell
npx vitest run tests/unit/home-workspace.test.tsx tests/unit/map-tab.test.tsx tests/unit/google-maps-place-sheet.test.tsx tests/unit/journal-tab.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 7**

```powershell
git add -- src/components/home/HomeWorkspace.tsx src/components/tabs/MapTab.tsx tests/unit/home-workspace.test.tsx tests/unit/map-tab.test.tsx
git commit -m "feat: route shared map places through confirmation"
```

---

### Task 8: Outbound Maps Actions, Memory Map, Resume Card, And Draft List

**Files:**
- Modify: `src/components/home/HomeWorkspace.tsx`
- Modify: `src/components/tabs/MapTab.tsx`
- Modify: `src/components/tabs/ExploreTab.tsx`
- Modify: `src/components/tabs/JournalTab.tsx`
- Modify: `tests/unit/home-workspace.test.tsx`
- Modify: `tests/unit/map-tab.test.tsx`
- Modify: `tests/unit/explore-tab.test.tsx`
- Modify: `tests/unit/journal-tab.test.tsx`

**Interfaces:**
- Consumes: Task 1 URL builder, Task 4 external launcher/session, Task 6 controller.
- Produces UI callbacks:

```ts
type OpenGoogleMapsAction = (
  poi: POI,
  action: "view" | "directions",
) => Promise<void>;
```

- [ ] **Step 1: Write failing outbound action tests**

From Map and Explore detail, assert these labels and callbacks:

```text
Google Maps에서 보기
길찾기
```

The HomeWorkspace test must assert the order:

1. save session with selected POI/action;
2. call `openGoogleMaps(buildGoogleMapsUrl(...))`;
3. show a browser fallback toast only when target is `browser`;
4. leave Paso visit data untouched.

- [ ] **Step 2: Write failing memory-map tests**

Given one untouched seed, one locally saved place, and one visited place:

- Map receives only saved/visited places;
- Explore still receives all non-dummy licensed places;
- empty Map shows `기록한 장소가 아직 없습니다`;
- empty Map offers `Google Maps에서 장소 찾기` and paste entry.

- [ ] **Step 3: Write failing resume and external-draft tests**

Journal tests must assert:

- a valid stored session shows `Google Maps에서 보던 장소의 기록을 이어가세요`;
- dismiss clears the session;
- completing a visit clears the session;
- drafts show `다시 열기`, `현재 위치로 기록`, and `삭제`;
- coordinate-less drafts never render a map marker;
- deleting a draft does not delete an already linked visit.

- [ ] **Step 4: Run focused tests and observe missing controls**

Run:

```powershell
npx vitest run tests/unit/map-tab.test.tsx tests/unit/explore-tab.test.tsx tests/unit/journal-tab.test.tsx tests/unit/home-workspace.test.tsx
```

Expected: FAIL because outbound controls, filtering, resume card, and draft list are absent.

- [ ] **Step 5: Implement outbound action orchestration**

Before launch:

```ts
await saveGoogleMapsSession({
  poiId: poi.id,
  action,
  startedAt: new Date().toISOString(),
});

const result = await openGoogleMaps(
  buildGoogleMapsUrl(action, {
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
  }),
);
```

Set the same session in HomeWorkspace state before opening the external app, so the resume card works whether Android keeps or kills the WebView. If launch rejects, keep the session so the user can copy/retry the link. Never mark the place as Google-saved.

- [ ] **Step 6: Change Map's default data role without deleting seeds**

Compute:

```ts
const memoryPois = journal.pois.filter(
  (poi) => poi.is_saved || poi.is_visited,
);
```

Pass `memoryPois` only to `MapTab`. Keep the full collection in Explore. Copy must call the Map a `기억 지도`, not an offline world map.

The empty-state `Google Maps에서 장소 찾기` action opens the exported `GOOGLE_MAPS_HOME_URL`; it does not fabricate a POI or request location.

- [ ] **Step 7: Restore and clear the outbound session**

On HomeWorkspace initialization, load a non-expired session. If its POI exists, select it and expose it to Journal. If the POI no longer exists, clear the session.

Journal dismissal and successful `recordVisit()` clear the session. Do not clear on permission denial, external app failure, or tab switching.

- [ ] **Step 8: Render and act on external drafts**

Journal receives `model.externalPlaceLinks.filter((link) => !link.poi_id)`. Actions:

- `다시 열기`: launch `external_url`;
- `현재 위치로 기록`: request lazy location, materialize, select, retain the normal manual journal form;
- `삭제`: remove only the external link after an explicit confirmation.

Linked external links do not appear in the draft list.

- [ ] **Step 9: Run all feature UI suites**

Run:

```powershell
npx vitest run tests/unit/map-tab.test.tsx tests/unit/explore-tab.test.tsx tests/unit/journal-tab.test.tsx tests/unit/home-workspace.test.tsx tests/unit/google-maps-place-sheet.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit Task 8**

```powershell
git add -- src/components/home/HomeWorkspace.tsx src/components/tabs/MapTab.tsx src/components/tabs/ExploreTab.tsx src/components/tabs/JournalTab.tsx tests/unit/home-workspace.test.tsx tests/unit/map-tab.test.tsx tests/unit/explore-tab.test.tsx tests/unit/journal-tab.test.tsx
git commit -m "feat: make Google Maps the travel companion"
```

---

### Task 9: Backup Copy, Privacy, Product Documentation, And iOS Handoff

**Files:**
- Modify: `src/components/tabs/ProfileTab.tsx`
- Modify: `public/privacy.html`
- Modify: `README.md`
- Modify: `README.en.md`
- Create: `docs/mobile/google-maps-companion.md`
- Modify: `docs/mobile/ios-handoff.md`
- Modify: `tests/unit/profile-tab.test.tsx`

**Interfaces:**
- Consumes: completed feature behavior.
- Produces: user-visible data boundary and reproducible operator documentation.

- [ ] **Step 1: Write the failing backup sensitivity copy test**

Profile must disclose:

```text
백업에는 방문 위치, 사진, 외부 Google Maps 링크가 포함될 수 있습니다.
```

The test must find this text near the JSON export action.

- [ ] **Step 2: Run the Profile test and observe missing copy**

Run:

```powershell
npx vitest run tests/unit/profile-tab.test.tsx
```

Expected: FAIL because external map links are not disclosed.

- [ ] **Step 3: Add exact privacy and product claims**

Korean and English documents must both state:

- Maps is opened only after user action;
- Android shares are received only after the user selects Paso in the Sharesheet;
- Paso stores the sanitized link locally;
- Paso never reads or writes personal Google Saved lists;
- journal content is not automatically sent to Google or the developer;
- uninstalling or deleting one app does not synchronize deletion to the other.

Do not use Google branding artwork or claim partnership.

- [ ] **Step 4: Document platform behavior and commands**

`docs/mobile/google-maps-companion.md` must include:

- Paso → Maps view/directions;
- Maps → Android Sharesheet → confirmation;
- coordinate-present and coordinate-missing paths;
- browser/iOS paste fallback;
- supported hosts and input limits;
- cold/warm adb commands using `com.mypaso.app.debug/.MainActivity`;
- Google Maps absent fallback;
- log privacy check;
- backup/restore check.

`docs/mobile/ios-handoff.md` must state that outbound Universal Links and paste fallback are ready, while a native Share Extension requires an App Group, extension target, signing, and macOS device verification.

- [ ] **Step 5: Run documentation-adjacent tests**

Run:

```powershell
npx vitest run tests/unit/profile-tab.test.tsx tests/unit/layout.test.ts tests/unit/native-config.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 9**

```powershell
git add -- src/components/tabs/ProfileTab.tsx public/privacy.html README.md README.en.md docs/mobile/google-maps-companion.md docs/mobile/ios-handoff.md tests/unit/profile-tab.test.tsx
git commit -m "docs: explain Google Maps privacy boundary"
```

---

### Task 10: Full Verification, Android Smoke Test, And Evidence

**Files:**
- Create: `docs/mobile/closed-test/evidence/google-maps-companion-2026-07-31.md`
- Create only when captured successfully: `docs/mobile/closed-test/evidence/google-maps-companion-phone.png`
- Create only when captured successfully: `docs/mobile/closed-test/evidence/google-maps-companion-tablet.png`
- Modify only if verification exposes a defect: the narrow owning source/test files from Tasks 1-9

**Interfaces:**
- Consumes: the full implementation.
- Produces: passing automated checks, Android artifacts, and reproducible evidence without publishing externally.

- [ ] **Step 1: Verify a clean scoped diff before full checks**

Run:

```powershell
git status --short
git diff --check
git log --oneline -10
```

Expected: no unrelated changes and no whitespace errors.

- [ ] **Step 2: Run the complete web regression suite**

Run sequentially:

```powershell
npm run test
npm run lint
npm run build
npm run build:mobile
npm run cap:sync:android
```

Expected: every command exits 0. The mobile build must use empty `basePath` and populate `out/`.

- [ ] **Step 3: Run Android unit and debug build**

```powershell
subst P: 'C:\Users\sinmb\workspace\Hello! My Paso! — Local-First Addendum\my-paso'
Push-Location P:\android
.\gradlew.bat :app:testDebugUnitTest --no-daemon --console=plain
.\gradlew.bat :app:assembleDebug --no-daemon --console=plain
Pop-Location
```

Expected:

- unit tests PASS;
- debug APK exists under `android/app/build/outputs/apk/debug/`;
- no URL, share text, or coordinates appear in build logs.

- [ ] **Step 4: Install the debug app and verify cold-start share**

Use the configured phone AVD:

```powershell
adb install -r 'P:\android\app\build\outputs\apk\debug\app-debug.apk'
adb shell am force-stop com.mypaso.app.debug
adb shell am start -n com.mypaso.app.debug/.MainActivity `
  -a android.intent.action.SEND `
  -t text/plain `
  --es android.intent.extra.TEXT '경복궁 https://maps.app.goo.gl/AbCdEf123'
```

Expected: confirmation sheet appears once, editable name is `경복궁`, and nothing is saved before confirmation.

- [ ] **Step 5: Verify warm-start, invalid input, and duplicate delivery**

While Paso is running:

```powershell
adb shell am start -n com.mypaso.app.debug/.MainActivity `
  -a android.intent.action.SEND `
  -t text/plain `
  --es android.intent.extra.TEXT '서울 https://www.google.com/maps/search/?api=1%26query=37.5665%2C126.9780'
```

Then send a non-Google URL and the same valid payload twice.

Expected:

- warm valid share opens one sheet;
- invalid share shows one generic error and stores nothing;
- duplicate native delivery does not create duplicate rows;
- launcher start never reopens an acknowledged share.

- [ ] **Step 6: Verify Maps installed and browser fallback branches**

From a selected local POI:

1. tap `Google Maps에서 보기`;
2. verify `com.google.android.apps.maps` becomes the resumed package when installed;
3. return and verify the Journal resume card;
4. on an AVD without Google Maps or with the package disabled, verify the same HTTPS URL opens in a browser;
5. re-enable any package changed for the test.

Do not uninstall or disable apps on a user-owned physical device.

- [ ] **Step 7: Verify coordinate and persistence behavior**

On the phone AVD:

1. save a coordinate-less short-link draft;
2. confirm it appears in Journal but not on the memory map;
3. inject an emulator GPS location;
4. choose `현재 위치로 기록`;
5. complete a visit with memo and one photo;
6. force-stop and reopen;
7. verify external link, POI, visit, memo, photo, and XP persist;
8. delete the external link and verify the visit remains.

- [ ] **Step 8: Verify backup round-trip**

1. export JSON;
2. confirm the warning mentions external links;
3. inspect that `version` is `2.2-local`, `schema_version` is `3`, and no token/cookie/account fields exist;
4. record the checksum;
5. reset app data through the existing UI;
6. restore the exported file;
7. verify external draft, linked place, visit, media, and XP counts;
8. import a known `2.1-local` fixture and verify zero external links without error.

- [ ] **Step 9: Check log privacy**

Clear logcat, repeat one inbound and outbound flow, then search exact fixture secrets:

```powershell
adb logcat -c
# Repeat the flow in the UI.
$pasoLog = adb logcat -d
$pasoLog | Select-String -SimpleMatch 'AbCdEf123'
$pasoLog | Select-String -SimpleMatch '37.5665'
$pasoLog | Select-String -SimpleMatch '경복궁'
```

Expected: all three searches return no app log entries. Android system command/activity traces may be excluded only when the line is clearly emitted by adb/ActivityManager rather than Paso.

- [ ] **Step 10: Verify tablet layout and capture evidence**

Run the same build on the configured landscape tablet AVD. Capture screenshots only after successful UI verification, using `adb pull` to preserve PNG bytes:

```powershell
adb shell screencap -p /sdcard/google-maps-companion-tablet.png
adb pull /sdcard/google-maps-companion-tablet.png 'docs\mobile\closed-test\evidence\google-maps-companion-tablet.png'
```

Capture the phone confirmation screen similarly as `google-maps-companion-phone.png`. Inspect both images before keeping them; delete a failed or misleading capture.

- [ ] **Step 11: Build the release bundle without publishing**

Run:

```powershell
npm run android:bundle:release
```

Expected: the existing release script exits 0 and produces its APK/AAB outputs. Do not upload to Play Console, create a release, send a message, or modify external state.

- [ ] **Step 12: Write evidence with exact outputs and hashes**

The report must record:

- commit SHA;
- Node, npm, Java, Gradle, adb, emulator/API versions;
- each command and exit status;
- test count;
- APK/AAB absolute paths, byte sizes, and SHA-256;
- cold/warm share results;
- Maps installed/fallback results;
- persistence and backup results;
- log privacy result;
- phone/tablet screenshot paths;
- iOS native share boundary.

Do not claim a branch passed when the relevant device or artifact was unavailable; record the exact constraint.

- [ ] **Step 13: Remove temporary drive and inspect retained artifacts**

```powershell
subst P: /D
git status --short
git diff --check
```

Delete failed screenshots and transient reports. Keep only verified evidence and intended source/document changes.

- [ ] **Step 14: Run final verification after evidence edits**

Run:

```powershell
npm run test
npm run lint
git diff --check
```

Expected: PASS and no whitespace errors.

- [ ] **Step 15: Commit verified evidence**

```powershell
git add -- docs/mobile/closed-test/evidence/google-maps-companion-2026-07-31.md
git add -- docs/mobile/closed-test/evidence/google-maps-companion-phone.png docs/mobile/closed-test/evidence/google-maps-companion-tablet.png
git commit -m "test: verify Google Maps companion flow"
```

If one screenshot was not successfully captured, omit that path from `git add` and state the limitation in the report.

---

## Completion Gate

Before reporting completion, verify all of the following from fresh command output:

- all ten task commits exist in order;
- `git status --short` is empty;
- Vitest, ESLint, web build, mobile build, Capacitor sync, Android JUnit, debug build, and release bundle passed;
- cold and warm inbound shares were verified;
- installed Maps and browser fallback were verified or the exact unavailable branch is documented;
- coordinate-less drafts never create fake POIs;
- confirmed links survive restart and verified backup/restore;
- acknowledged or invalid shares do not reappear;
- no sensitive share data appears in Paso logs;
- no Google account, OAuth, Saved-list CRUD, Places API, backend, or analytics was introduced;
- no Play Console upload or other external publication occurred.

## Execution Choice

Use **Subagent-Driven Development** for this plan. The repository instruction explicitly asks for development to be separated across contexts, and the user delegated remaining implementation choices. Dispatch one fresh implementation agent per task, then run specification review and code-quality review before proceeding to the next task. The root agent owns integration, full verification, artifact inspection, and the final evidence report.
