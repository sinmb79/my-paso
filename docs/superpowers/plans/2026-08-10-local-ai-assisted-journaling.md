# Local AI-assisted Journaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user preview and send one selected photo and/or short note to an owner-controlled Korean local model, edit the returned structured draft, and apply it to the existing journal form without automatic persistence.

**Architecture:** Pure TypeScript leaf modules enforce model capabilities, endpoint locality, minimal request context, response validation, and bounded networking. A React hook coordinates transient state; Profile settings and a Journal sheet expose configuration, preview, generation, and draft application.

**Tech Stack:** TypeScript 5, React 19, Vitest, Testing Library, browser `fetch`, Canvas image re-encoding, Capacitor Preferences.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-10-local-ai-assisted-journaling-and-visual-refresh-design.md`.
- Observe each production behavior fail in a focused test before implementing it.
- The AI layer imports neither SQLite queries nor journal persistence methods.
- Call only `/v1/chat/completions` with `redirect: "error"` and abort timeout.
- Accept and store no API key or URL credential.
- Text-only models never receive image content.
- Applying a draft changes React form state only.
- Persisted 0.3.0 fields use existing storage: body becomes memo/review text, mood maps to an existing mood, and confirmed keywords merge into existing POI tags on the user's normal save action. Title is folded into editable body text; category and alt text remain visible suggestions because the current schema has no truthful persistence field.

---

### Task 1: Contracts, model catalog, and endpoint policy

**Files:**
- Create: `src/lib/ai/contracts.ts`
- Create: `src/lib/ai/model-catalog.ts`
- Create: `src/lib/ai/endpoint-policy.ts`
- Create: `tests/unit/local-ai.test.ts`

**Interfaces:**
- Produces: `LocalAIVendor`, `LocalAICapability`, `LocalAISettings`, `LocalAIDraft`, `LocalAIRequestPreview`, `LOCAL_AI_MODEL_CATALOG`, and `validateLocalAIEndpoint`.
- Consumes: `POICategory` from `src/types/index.ts`.

- [ ] **Step 1: Write failing catalog and endpoint-policy tests**

```ts
expect(LOCAL_AI_MODEL_CATALOG.map((item) => item.vendor)).toEqual([
  "naver",
  "kakao",
  "lg",
  "skt",
]);
expect(validateLocalAIEndpoint("http://127.0.0.1:8000")).toMatchObject({
  ok: true,
  scope: "loopback",
});
expect(validateLocalAIEndpoint("http://192.168.0.20:8000")).toMatchObject({
  ok: false,
  reason: "confirmation_required",
});
expect(validateLocalAIEndpoint("https://example.com/v1")).toMatchObject({ ok: false });
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
npm test -- tests/unit/local-ai.test.ts
```

Expected: FAIL because the three AI modules do not exist.

- [ ] **Step 3: Implement the exact public contracts**

```ts
export type LocalAIVendor = "naver" | "kakao" | "lg" | "skt";
export type LocalAICapability = "text" | "vision";
export type LocalAIEndpointScope = "loopback" | "private_lan";
export type LocalAIIntent = "journal_draft" | "classify_keywords" | "photo_alt";

export type LocalAISettings = {
  enabled: boolean;
  vendor: LocalAIVendor;
  endpoint: string;
  model: string;
  capability: LocalAICapability;
  confirmedPrivateLANEndpoint: string | null;
};

export type LocalAIDraft = {
  title: string;
  body: string;
  category: POICategory | null;
  keywords: string[];
  mood: string | null;
  altText: string;
  observations: string[];
};
```

Catalog entries contain vendor label, text model, vision model, HTTPS model-card URL, and license notice. Endpoint policy accepts `localhost`, `127.0.0.1`, `[::1]`, and confirmed literal IPv4 ranges `10/8`, `172.16/12`, and `192.168/16`; it rejects URL credentials, fragments, hostnames other than `localhost`, public IPs, and non-HTTP(S) schemes.

- [ ] **Step 4: Run focused tests and verify GREEN**

```powershell
npm test -- tests/unit/local-ai.test.ts
```

- [ ] **Step 5: Commit the policy layer**

```powershell
git add src/lib/ai/contracts.ts src/lib/ai/model-catalog.ts src/lib/ai/endpoint-policy.ts tests/unit/local-ai.test.ts
git commit -m "feat: define local AI privacy boundary"
```

### Task 2: Minimal context, strict draft validation, and bounded client

**Files:**
- Create: `src/lib/ai/context-builder.ts`
- Create: `src/lib/ai/draft-validator.ts`
- Create: `src/lib/ai/openai-compatible.ts`
- Modify: `tests/unit/local-ai.test.ts`

**Interfaces:**
- Produces: `buildLocalAIRequest(preview)`, `validateLocalAIDraft(value)`, and `createOpenAICompatibleAssistant(options)`.
- Consumes: Task 1 contracts.

- [ ] **Step 1: Add failing minimization and validation tests**

```ts
const request = buildLocalAIRequest({
  intent: "journal_draft",
  placeName: "천지연폭포",
  note: "물소리가 시원했다",
  imageDataUrl: null,
});
expect(JSON.stringify(request)).not.toMatch(/latitude|longitude|photoId|exif|backup/i);
expect(validateLocalAIDraft({ title: "기억", body: "본문", keywords: [] })).toMatchObject({
  title: "기억",
  body: "본문",
});
```

Cover unknown category, long fields, duplicate/more-than-eight keywords, and unknown response keys.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- tests/unit/local-ai.test.ts
```

- [ ] **Step 3: Implement the strict request builder and validator**

The system prompt requests one JSON object, separates observations from interpretations, and forbids person/place/date assertions not supplied by the user. Clamp title to 80, body to 1,000, keyword count to 8 and keyword length to 24, mood to 24, alt text to 240, and observations to five entries of 120 characters.

- [ ] **Step 4: Add failing client tests**

```ts
expect(fetch).toHaveBeenCalledWith(
  "http://127.0.0.1:8000/v1/chat/completions",
  expect.objectContaining({ method: "POST", redirect: "error" }),
);
```

Cover text, vision, text-only photo exclusion, HTTP 500, empty choices, timeout, cancellation, and invalid JSON. Assert endpoint policy runs again immediately before `fetch`.

- [ ] **Step 5: Implement the client**

```ts
export function createOpenAICompatibleAssistant(options: {
  settings: LocalAISettings;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): {
  testConnection(signal?: AbortSignal): Promise<{ model: string }>;
  generate(preview: LocalAIRequestPreview, signal?: AbortSignal): Promise<LocalAIDraft>;
};
```

Use a 45-second default timeout, release timers in `finally`, append the chat-completions path to the validated origin, and send no authorization header.

- [ ] **Step 6: Run and commit**

```powershell
npm test -- tests/unit/local-ai.test.ts
git add src/lib/ai/context-builder.ts src/lib/ai/draft-validator.ts src/lib/ai/openai-compatible.ts tests/unit/local-ai.test.ts
git commit -m "feat: add bounded local AI client"
```

### Task 3: Photo sanitizer and local settings

**Files:**
- Create: `src/lib/ai/photo-sanitizer.ts`
- Create: `src/lib/ai/preferences.ts`
- Modify: `src/lib/native/preferences.ts`
- Modify: `tests/unit/local-ai.test.ts`
- Modify: `tests/unit/native-wrappers.test.ts`

**Interfaces:**
- Produces: `sanitizePhotoForLocalAI`, `loadLocalAISettings`, `saveLocalAISettings`, `clearLocalAISettings`, and generic `removeSetting`.

- [ ] **Step 1: Add failing photo/settings tests**

Mock image decode and canvas so a 2400x1600 input produces a 1280x853 re-encoded output. Assert settings round-trip without secrets and can be removed.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- tests/unit/local-ai.test.ts tests/unit/native-wrappers.test.ts
```

- [ ] **Step 3: Implement re-encoding and settings storage**

`sanitizePhotoForLocalAI` accepts JPEG/PNG/WebP data URLs, creates a new canvas, limits the longest edge to 1280, outputs JPEG/WebP near 82% quality, and never mutates or persists its input. Add `removeSetting` through Capacitor Preferences or web localStorage.

- [ ] **Step 4: Run and commit**

```powershell
npm test -- tests/unit/local-ai.test.ts tests/unit/native-wrappers.test.ts
git add src/lib/ai/photo-sanitizer.ts src/lib/ai/preferences.ts src/lib/native/preferences.ts tests/unit/local-ai.test.ts tests/unit/native-wrappers.test.ts
git commit -m "feat: sanitize local AI photo input"
```

### Task 4: Local assistant hook and Profile settings

**Files:**
- Create: `src/hooks/useLocalAssistant.ts`
- Create: `src/components/ai/LocalAISettings.tsx`
- Create: `tests/unit/local-ai-ui.test.tsx`
- Modify: `src/components/tabs/ProfileTab.tsx`
- Modify: `tests/unit/profile-tab.test.tsx`

**Interfaces:**
- Produces: `useLocalAssistant()` with settings, loading, connection test, generation, cancellation, and errors.
- Consumes: Tasks 1–3.

- [ ] **Step 1: Write failing UI tests**

Assert Profile shows `로컬 AI`, defaults disabled, offers four vendors, rejects `https://example.com`, requires confirmation for `192.168.0.20`, links to the selected model card, and tests a connection without journal content.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- tests/unit/local-ai-ui.test.tsx tests/unit/profile-tab.test.tsx
```

- [ ] **Step 3: Implement hook and settings**

The hook owns and cancels its `AbortController` and exposes no save method. Settings store only `LocalAISettings`, show `이 브라우저의 localhost` or `내 사설망 기기`, and keep AI disabled until endpoint validation passes.

- [ ] **Step 4: Mount under Profile owner controls**

Add `<LocalAISettings onToast={onToast} />` without changing `PasoJournalController`.

- [ ] **Step 5: Run and commit**

```powershell
npm test -- tests/unit/local-ai-ui.test.tsx tests/unit/profile-tab.test.tsx
git add src/hooks/useLocalAssistant.ts src/components/ai/LocalAISettings.tsx src/components/tabs/ProfileTab.tsx tests/unit/local-ai-ui.test.tsx tests/unit/profile-tab.test.tsx
git commit -m "feat: add local AI settings"
```

### Task 5: Mandatory preview sheet and Journal draft application

**Files:**
- Create: `src/components/ai/LocalAIAssistantSheet.tsx`
- Modify: `src/components/tabs/JournalTab.tsx`
- Modify: `tests/unit/local-ai-ui.test.tsx`
- Modify: `tests/unit/journal-tab.test.tsx`

**Interfaces:**
- Consumes: current memo, review text, selected draft photo, place name, setters, and `model.updatePoiTags`.
- Produces: `onApply(draft)`; no persistence method.

- [ ] **Step 1: Write failing preview/no-auto-save tests**

Cover photo-plus-note preview, excluded-data disclosure, text-only photo exclusion, generation/cancellation/error states, editable returned fields, and applying body/mood/keywords. Assert `recordVisit`, `saveReview`, `saveJournalPhoto`, and `updatePoiTags` remain uncalled immediately after `초안에 적용`.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- tests/unit/local-ai-ui.test.tsx tests/unit/journal-tab.test.tsx
```

- [ ] **Step 3: Implement the sheet**

Use an accessible modal dialog with explicit place/note/photo preview and exclusions `정밀 위치`, `사진 메타데이터`, `다른 기록`, and `백업 데이터`. Offer `기록 초안`, `분류와 키워드`, and `사진 설명` intents.

- [ ] **Step 4: Integrate Journal state**

Display `AI로 빠르게 작성` only for valid enabled settings. Fold non-empty title and body into editable memo/review text, map known mood labels, keep category/alt text as visible suggestions, and hold selected keywords in local component state. On the user's existing `방문 기록하기`, merge confirmed keywords into the selected POI's existing tags through `updatePoiTags` after the visit succeeds; never call it from the AI sheet.

- [ ] **Step 5: Run and commit**

```powershell
npm test -- tests/unit/local-ai-ui.test.tsx tests/unit/journal-tab.test.tsx
git add src/components/ai/LocalAIAssistantSheet.tsx src/components/tabs/JournalTab.tsx tests/unit/local-ai-ui.test.tsx tests/unit/journal-tab.test.tsx
git commit -m "feat: add AI assisted journal drafts"
```

### Task 6: AI regression gate

**Files:**
- Verify only.

- [ ] **Step 1: Run related tests**

```powershell
npm test -- tests/unit/local-ai.test.ts tests/unit/local-ai-ui.test.tsx tests/unit/journal-tab.test.tsx tests/unit/profile-tab.test.tsx tests/unit/native-wrappers.test.ts
```

- [ ] **Step 2: Run static checks**

```powershell
npm run lint
npm run build
npm run build:mobile
```

- [ ] **Step 3: Inspect excluded-field references**

```powershell
rg -n "latitude|longitude|gps|EXIF|photoId|backup|api[_-]?key|Authorization" src/lib/ai src/components/ai src/hooks/useLocalAssistant.ts
```

Expected: occurrences are limited to explicit exclusion logic/copy; request serialization has none of the excluded fields and no authorization header.
