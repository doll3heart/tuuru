# Reader Work Release Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the reader reliably distinguish a newer, identical, older, or conflicting export of the same work while preserving existing reader-owned data.

**Architecture:** Keep the existing immutable `work.id` as the work identity; it is already regenerated when an author duplicates a work. Add a small `release` envelope to exported copies only, derived from the author draft's `updatedAt` and a deterministic content fingerprint. A pure comparison module classifies an incoming work against the cached work, and the existing import review renders the classification without changing storage keys or reader save formats.

**Tech Stack:** Browser ES modules, Node test runner, jsdom integration tests, existing Vite build.

## Global Constraints

- No network call, API usage, account system, or AI processing.
- Existing `.tuuru`, JSON, PNG, and collection transports remain readable.
- Legacy exports without release metadata remain importable and are never auto-classified as newer.
- Reader progress, identities, placeholder values, slots, and bookmarks remain owned by `reader-library-state`.
- Duplicating a work continues to generate a new `work.id`.

---

### Task 1: Release metadata and comparison

**Files:**
- Create: `js/work-release.js`
- Create: `tests/work-release.test.mjs`

**Interfaces:**
- Produces: `createWorkRelease(work, exportedAt)`, `normalizeWorkRelease(value, workId)`, and `classifyWorkRelease(incoming, existing)`.
- Consumes: JSON-safe work objects whose editor-only fields have already been removed.

- [ ] **Step 1: Write failing tests**

Cover deterministic fingerprints, increasing revisions, invalid/mismatched metadata, and the `newer`, `same`, `older`, `conflict`, and `unknown` classifications.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/work-release.test.mjs`

Expected: FAIL because `js/work-release.js` does not exist.

- [ ] **Step 3: Implement the pure release module**

Canonicalize object keys, omit the `release` envelope and reader-owned transient fields from the fingerprint, create a bounded numeric revision from `updatedAt`, and compare only works with the same exact `id`.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/work-release.test.mjs`

Expected: all release tests pass.

### Task 2: Export and schema transport

**Files:**
- Modify: `js/data.js`
- Modify: `js/work-schema.js`
- Modify: `tests/work-transport-parity.test.mjs`
- Modify: `tests/work-schema.test.mjs`

**Interfaces:**
- Consumes: `createWorkRelease` and `normalizeWorkRelease`.
- Produces: exported work objects with `{ release: { version, workId, revision, exportedAt, fingerprint } }`.

- [ ] **Step 1: Add failing transport and validation tests**

Assert that dedicated, PNG-source, and collection exports share release metadata; validation preserves valid metadata and removes invalid or mismatched metadata.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/work-transport-parity.test.mjs tests/work-schema.test.mjs`

Expected: new assertions fail.

- [ ] **Step 3: Attach and normalize release metadata**

Create the envelope after editor-only fields are removed in `exportWorkAsJSON`, then normalize it in `validateAndNormalizeWork` without rejecting legacy works.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/work-transport-parity.test.mjs tests/work-schema.test.mjs`

Expected: all focused tests pass.

### Task 3: Reader import review states

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-import-resilience.test.mjs`

**Interfaces:**
- Consumes: `classifyWorkRelease(incoming, existing)`.
- Produces: state-specific import review copy and explicit confirmation actions.

- [ ] **Step 1: Add failing integration tests**

Import newer, identical, older, conflicting, and legacy same-ID works. Assert the review heading, explanatory copy, button label, focus behavior, and that the existing cache is untouched before confirmation.

- [ ] **Step 2: Run the focused reader test**

Run: `node --test tests/reader-import-resilience.test.mjs`

Expected: new state-specific assertions fail.

- [ ] **Step 3: Render the classifications**

Use “发现作品更新” for newer releases, “当前版本已在书架” for identical releases, “这是较早的版本” for older releases, “版本标记存在冲突” for conflicts, and retain the current generic review for legacy exports. Keep all replacements behind an explicit button.

- [ ] **Step 4: Polish interaction states**

Reuse the existing import review structure, add a restrained status treatment, preserve 44px touch targets and visible focus, and do not introduce another modal or navigation entry.

- [ ] **Step 5: Run the focused reader test**

Run: `node --test tests/reader-import-resilience.test.mjs`

Expected: all reader import resilience tests pass.

### Task 4: Verification

**Files:**
- Verify all modified files above.

- [ ] **Step 1: Run the complete verification**

Run: `npm run verify`

Expected: zero test failures and both production builds succeed.

- [ ] **Step 2: Inspect repository state**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended release identity files are changed.

### Task 5: Spoiler-free update analysis

**Files:**
- Create: `reader/work-update-analysis.js`
- Create: `tests/reader-work-update-analysis.test.mjs`
- Modify: `reader/work-import-review.js`

**Interfaces:**
- Produces: `summarizeReaderWorkUpdate(existing, incoming)`, returning bounded labels such as `新增 2 个章节`, `修改 4 段正文`, and `新增 12 条消息`.
- Consumes: two same-ID normalized reader works.

- [ ] **Step 1: Write failing tests**

Build article and phone pairs whose IDs and contents change. Assert that only category counts are returned and that no chapter title, message body, post body, or author text appears in the summary.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/reader-work-update-analysis.test.mjs`

Expected: FAIL because the analysis module does not exist.

- [ ] **Step 3: Implement bounded semantic counting**

Compare stable IDs for chapters, article nodes, messages, forum posts, memos, and images. Return at most four non-zero Chinese labels and expose no authored content.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/reader-work-update-analysis.test.mjs`

Expected: all update analysis tests pass.

### Task 6: Placeholder and bookmark continuity

**Files:**
- Modify: `reader/reader-library-state.js`
- Modify: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Produces: `reconcileReaderWorkUpdate(library, previousWork, incomingWork, options)` and `dismissReaderWorkUpdate(library, workId)`.
- Consumes: current reader library, old cached work, and confirmed incoming work.

- [ ] **Step 1: Write failing migration tests**

Assert exact-ID placeholder preservation, unique key fallback, unique label fallback, ambiguous-match rejection, multi-slot migration, unchanged bookmark preservation, missing-node bookmark repair, and the optional unseen-update timestamp.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: new migration imports or assertions fail.

- [ ] **Step 3: Implement conservative placeholder migration**

Match each new definition by ID, then a unique normalized key, then a unique normalized label. Never copy one old value into multiple ambiguous new definitions.

- [ ] **Step 4: Implement bookmark repair**

Keep valid paths unchanged. For removed nodes, find a unique same-title or same-text node in the corresponding chapter, then fall back to the closest structural position. Mark repaired bookmarks with `updateStatus:"moved"` and retain their user label and note.

- [ ] **Step 5: Persist and dismiss update state**

Store `unseenUpdateAt` only for confirmed newer releases, preserve it through normalization, and clear it when the reader explicitly opens the book from the shelf.

- [ ] **Step 6: Run the focused test**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: all library state tests pass.

### Task 7: Import actions and bookshelf feedback

**Files:**
- Modify: `reader/work-import-review.js`
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-work-import-review.test.mjs`
- Modify: `tests/reader-import-resilience.test.mjs`
- Modify: `tests/reader-bookshelf-ui.test.mjs`

**Interfaces:**
- Consumes: update summary and reader-state reconciliation.
- Produces: continue/rewrite actions for identical releases, memory-only preview for older/conflicting releases, update summary markup, migrated bookmark notice, and a one-use bookshelf marker.

- [ ] **Step 1: Write failing action tests**

Assert that identical releases make `继续阅读` primary and `重新写入缓存` secondary; older/conflicting releases expose `仅本次打开`; newer releases show the spoiler-free summary.

- [ ] **Step 2: Implement explicit action dispatch**

Continue the cached same release without writing. Re-cache only when explicitly selected. Open old/conflicting releases with `remember:false` so neither the cache nor reader library is overwritten.

- [ ] **Step 3: Render continuity feedback**

Render update summary rows inside the existing review, `已更新` inside the cover with no pointer interception, and `原位置已变动，已定位到附近内容` beside repaired bookmarks.

- [ ] **Step 4: Polish responsive and accessible states**

Keep all actions at least 44px tall, preserve visible focus, let three-action layouts stack on narrow screens, and use existing neutral/accent tokens without decorative cards.

- [ ] **Step 5: Run focused UI tests**

Run: `node --test tests/reader-work-import-review.test.mjs tests/reader-import-resilience.test.mjs tests/reader-bookshelf-ui.test.mjs`

Expected: all focused UI tests pass.

### Task 8: Complete verification

**Files:**
- Verify every file from Tasks 1–7.

- [ ] **Step 1: Run complete tests and production builds**

Run: `npm run verify`

Expected: zero failures and both production build targets succeed.

- [ ] **Step 2: Check the final patch**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and no unrelated files.
