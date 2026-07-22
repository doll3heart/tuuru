# Full-Feature Showcase Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one importable, deterministic Tuuru article that labels and demonstrates the complete article/phone-module feature surface, plus a mobile screenshot set captured from the production reader.

**Architecture:** Add a dedicated showcase fixture rather than changing application defaults or the existing story-based acceptance works. Generate JSON and steganographic PNG artifacts from the same fixture, validate them through the production import schema, then drive the real reader in a 390×844 browser viewport to capture repeatable screenshots.

**Tech Stack:** Native ES modules, Node built-ins, existing Tuuru schema/steganography helpers, Vite, Edge DevTools Protocol, `node:test`.

## Global Constraints

- The showcase contains labels and demonstration copy, not a story.
- It must cover multiple chapters, nodes, choice branches/merge/back navigation, three placeholder replacements, images, watermarking, and all seven article phone modules.
- Screenshots must come from the real reader at a mobile viewport and must not modify user browser storage.
- No application storage schema, import/export format, or production UI behavior may change.

---

### Task 1: Deterministic showcase artifact

**Files:**
- Create: `scripts/showcase-article-fixture.mjs`
- Create: `scripts/generate-showcase-article.mjs`
- Create: `samples/showcase/README.md`
- Generate: `samples/showcase/tuuru-full-feature-showcase.json`
- Generate: `samples/showcase/tuuru-full-feature-showcase.png`

**Interfaces:**
- Consumes: `createIllustrationDataUrl()`, `encodeSteganoPngBuffer()`, `CURRENT_WORK_SCHEMA_VERSION`, and `validateWorkForImport()`.
- Produces: `SHOWCASE_ARTICLE_FILE` and `buildShowcaseArticleWork()` for tests and screenshot capture.

- [ ] **Step 1:** Add a failing test that requires four chapters, at least ten nodes, three placeholder keys, valid choice targets, all seven module types, embedded images, and a full-screen cross watermark.
- [ ] **Step 2:** Run `node --test tests/showcase-article.test.mjs`; expect failure because the fixture module is absent.
- [ ] **Step 3:** Implement the labelled fixture and generator, with explicit copy such as `【这是章节1】`, `【这是选项组1】`, and `【这是一段备忘录】`.
- [ ] **Step 4:** Run `node scripts/generate-showcase-article.mjs`; expect matching JSON and PNG artifacts in `samples/showcase/`.
- [ ] **Step 5:** Run the focused test; expect all showcase structure and production-import assertions to pass.

### Task 2: Mobile screenshot capture

**Files:**
- Create: `scripts/capture-showcase-article.mjs`
- Generate: `samples/showcase/screenshots/*.png`
- Generate: `samples/showcase/screenshots/manifest.json`

**Interfaces:**
- Consumes: `buildShowcaseArticleWork()` and the real `/reader/` entry.
- Produces: numbered 390×844 screenshots and a manifest mapping filenames to the demonstrated feature.

- [ ] **Step 1:** Start Vite on an isolated local port and launch Edge with an isolated temporary profile.
- [ ] **Step 2:** Inject only the showcase work into that temporary reader storage, open its landing dialog, fill `某某=小桃`, `小某=桃桃`, and `wm=桃子汽水`, then begin reading.
- [ ] **Step 3:** Capture landing, placeholder replacement, formatting/image/watermark, choice branching, back navigation, all seven phone modules, message choice/call, and reader appearance controls.
- [ ] **Step 4:** Assert every capture state has the expected visible heading/control and no horizontal overflow before writing its PNG.
- [ ] **Step 5:** Write `manifest.json` with screenshot dimensions and feature descriptions.

### Task 3: Verification and handoff

**Files:**
- Create: `tests/showcase-article.test.mjs`
- Modify: `samples/showcase/README.md`

**Interfaces:**
- Consumes: generated showcase artifacts and screenshot manifest.
- Produces: a reproducible verification command and documented import password/route.

- [ ] **Step 1:** Validate both JSON and decoded PNG through `validateWorkForImport()` and assert their normalized work payloads are equivalent.
- [ ] **Step 2:** Verify every manifest screenshot exists, is 390×844, and maps to a named feature.
- [ ] **Step 3:** Run `node --test tests/showcase-article.test.mjs tests/acceptance-sample-works.test.mjs` and `npm run build:verify`; expect success.
- [ ] **Step 4:** Inspect the generated screenshots visually and remove any duplicated, clipped, or loading-state capture.
- [ ] **Step 5:** Deliver links to the JSON, PNG, README, manifest, and the strongest individual mobile screenshots.

**Execution note:** The user requested immediate production of the sample and screenshots, so this plan is executed inline in the current task without subagent delegation.
