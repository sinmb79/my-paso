# Paso Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Unify the bright product UI and amber archive motif with restrained GPT-image textures, clearer hierarchy, truthful map labeling, and complete focus/selection states.

**Architecture:** Two decorative assets provide a shared paper-and-light-trail motif while CSS tokens control surfaces, focus, motion, and contrast. Existing feature components retain their data behavior; layout changes are verified through accessible state assertions and final device screenshots.

**Tech Stack:** GPT Image 2, Next Image, Tailwind CSS 4, CSS custom properties, React 19, Vitest, Testing Library.

## Global Constraints

- Generated images are decorative and contain no text, logo, person, landmark, city, map, POI, or simulated user photo.
- Existing map positions, filters, journal persistence, Profile backup, and XP behavior do not change.
- Informational text is at least 12px; decorative eyebrow text may remain smaller.
- Interactive targets remain at least 44px and expose visible focus.
- Reduced-motion users do not receive non-essential animation.
- Image outputs are inspected before source code references them; failed variants are removed.

---

### Task 1: Generate and validate GPT Image brand textures

**Files:**
- Create: output/imagegen/paso-memory-trail-light.png
- Create: output/imagegen/paso-memory-trail-dark.png
- Create: public/brand/paso-memory-trail-light.webp
- Create: public/brand/paso-memory-trail-dark-v2.webp
- Create: docs/product/2026-08-10-visual-asset-record.md

**Interfaces:**
- Produces: two text-free decorative assets and a reproducibility record.

- [ ] **Step 1: Generate the light asset with GPT Image 2**

Use case stylized-concept; request warm ivory Korean paper fibers, nearly invisible contour impressions that cannot be read as a real map, and one thin restrained amber thread moving across generous negative space. Avoid text, symbols, pins, buildings, landmarks, people, photographs, strong gradients, lens flare, and saturation.

- [ ] **Step 2: Generate the dark asset with GPT Image 2**

Use the same material language with charcoal-brown paper, a subtle amber thread, low contrast, and generous safe areas for UI copy. Repeat every prohibited element from Step 1.

- [ ] **Step 3: Inspect both images at original resolution**

Confirm composition, texture, absence of text/logos/real geography, and UI-safe contrast. Delete rejected variants and retain only the two accepted PNGs.

- [ ] **Step 4: Create optimized WebP copies**

Use the bundled Pillow or Sharp runtime to cap the longest edge at 1600px. Record dimensions and file sizes. Keep source PNGs under output/imagegen and runtime WebPs under public/brand.

- [ ] **Step 5: Record prompt and output facts**

Record exact structured prompts, generation date, filenames, dimensions, sizes, SHA-256 hashes, and inspection results.

- [ ] **Step 6: Commit accepted assets**

~~~powershell
git add output/imagegen public/brand docs/product/2026-08-10-visual-asset-record.md
git commit -m "design: add Paso memory trail textures"
~~~

### Task 2: Shared visual tokens, focus state, navigation, and truthful map copy

**Files:**
- Modify: src/app/globals.css
- Modify: src/components/ui/BottomNav.tsx
- Modify: src/components/map/OfflineMapCanvas.tsx
- Create: tests/unit/bottom-nav.test.tsx
- Modify: tests/unit/map-tab.test.tsx

**Interfaces:**
- Produces: visual tokens, active navigation semantics, and truthful canvas label.

- [ ] **Step 1: Write failing semantic tests**

~~~tsx
expect(screen.getByRole("button", { name: "저널" })).toHaveAttribute(
  "aria-current",
  "page",
);
expect(screen.getByText("장소 분포도 · 길찾기용 아님")).toBeInTheDocument();
~~~

Assert the inactive navigation buttons omit aria-current.

- [ ] **Step 2: Run and verify RED**

~~~powershell
npm test -- tests/unit/bottom-nav.test.tsx tests/unit/map-tab.test.tsx
~~~

- [ ] **Step 3: Implement tokens and accessibility states**

Add --paso-paper, --paso-night, --paso-amber, --surface-radius, --surface-shadow, and --focus-ring. Add a global focus-visible outline at least 2px wide with offset and a reduced-motion rule that removes non-essential transitions and smooth scrolling. Set aria-current="page" only on the active BottomNav button.

- [ ] **Step 4: Replace misleading map copy**

Use exactly "장소 분포도 · 길찾기용 아님" and explain that registered places are shown relatively. Do not change coordinates or marker callbacks.

- [ ] **Step 5: Run and commit**

~~~powershell
npm test -- tests/unit/bottom-nav.test.tsx tests/unit/map-tab.test.tsx
git add src/app/globals.css src/components/ui/BottomNav.tsx src/components/map/OfflineMapCanvas.tsx tests/unit/bottom-nav.test.tsx tests/unit/map-tab.test.tsx
git commit -m "design: improve navigation and map clarity"
~~~

### Task 3: Compact Explore controls without behavior loss

**Files:**
- Modify: src/components/tabs/ExploreTab.tsx
- Modify: tests/unit/explore-tab.test.tsx

**Interfaces:**
- Preserves: query, StateFilter, activeCategory, visible-count reset, details, saving, tags, and map navigation.
- Produces: one compact filter region with accessible state and category controls.

- [ ] **Step 1: Add failing behavior and semantics tests**

Assert selecting "저장한 장소" and then "자연" produces the expected intersection; changing a filter resets pagination; controls are in a "장소 필터" region; selected controls expose aria-pressed="true".

- [ ] **Step 2: Run and verify RED**

~~~powershell
npm test -- tests/unit/explore-tab.test.tsx
~~~

- [ ] **Step 3: Implement the compact filter region**

Keep the state segment at 44px and place category chips directly below within one rounded surface. Reduce vertical gaps and header padding without hiding categories or changing filter logic. Add the light paper texture as a low-opacity decorative header layer.

- [ ] **Step 4: Run and commit**

~~~powershell
npm test -- tests/unit/explore-tab.test.tsx
git add src/components/tabs/ExploreTab.tsx tests/unit/explore-tab.test.tsx
git commit -m "design: compact the Explore workspace"
~~~

### Task 4: Unify Journal, Profile, and local-assistant surfaces

**Files:**
- Modify: src/components/tabs/JournalTab.tsx
- Modify: src/components/tabs/ProfileTab.tsx
- Modify: src/components/ai/LocalAISettings.tsx
- Modify: src/components/ai/LocalAIAssistantSheet.tsx
- Modify: tests/unit/journal-tab.test.tsx
- Modify: tests/unit/profile-tab.test.tsx
- Modify: tests/unit/local-ai-ui.test.tsx

**Interfaces:**
- Consumes: final WebP assets and shared tokens.
- Preserves: Journal saves, photos, GPS, timeline, Profile statistics, backup/restore, and AI privacy behavior.

- [ ] **Step 1: Add failing visible-copy assertions**

Assert Profile displays "이 기기에 보관됨 · 계정 없음", Journal keeps "오늘의 발자국을 남겨요", and the AI preview shows "로컬에서 초안 만들기" plus endpoint locality.

- [ ] **Step 2: Run and verify RED**

~~~powershell
npm test -- tests/unit/journal-tab.test.tsx tests/unit/profile-tab.test.tsx tests/unit/local-ai-ui.test.tsx
~~~

- [ ] **Step 3: Apply texture and hierarchy**

Use the light asset at low opacity in Journal, Explore, and AI surfaces and the dark asset in Profile. Keep text as real HTML, add local-ownership status below Profile hero, normalize radii/shadows, and hide decorative images from assistive technology.

- [ ] **Step 4: Run and commit**

~~~powershell
npm test -- tests/unit/journal-tab.test.tsx tests/unit/profile-tab.test.tsx tests/unit/local-ai-ui.test.tsx
git add src/components/tabs/JournalTab.tsx src/components/tabs/ProfileTab.tsx src/components/ai tests/unit/journal-tab.test.tsx tests/unit/profile-tab.test.tsx tests/unit/local-ai-ui.test.tsx
git commit -m "design: unify Paso memory surfaces"
~~~

### Task 5: Visual regression and real screenshot evidence

**Files:**
- Replace: docs/mobile/store-assets/screenshot-01-map.png
- Replace: docs/mobile/store-assets/screenshot-02-explore.png
- Replace: docs/mobile/store-assets/screenshot-03-journal.png
- Replace: docs/mobile/store-assets/screenshot-04-profile.png
- Replace: docs/mobile/store-assets/screenshot-05-tablet-landscape.png
- Create: docs/mobile/closed-test/evidence/report-0.3.0.md

- [ ] **Step 1: Run automated UI regression**

~~~powershell
npm test
npm run lint
npm run build
npm run build:mobile
~~~

- [ ] **Step 2: Inspect required states**

Review phone portrait and tablet landscape for default, selected, empty, loading, error, keyboard focus, AI disabled/configured, preview, response, and timeout. Check 200% text zoom and reduced motion where supported.

- [ ] **Step 3: Capture real app screenshots**

Use the Android emulator/app build rather than generated UI mockups. Keep generated textures as background decoration only.

- [ ] **Step 4: Record evidence**

Record device profile, build version, orientation, commands, test counts, limitations, and screenshot paths in report-0.3.0.md.
