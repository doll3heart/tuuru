# Reader Precise Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reopen each saved journey at the exact visible article passage or phone conversation position where the reader stopped.

**Architecture:** Extend the existing per-slot progress object with a small, sanitized `readingPosition` value. Reuse the article anchor capture/restore logic already used by temporary overlays, and add an equivalent phone location tracker for the active App and chat message scroller. Save positions with a short debounce plus immediate lifecycle checkpoints; restoring remains silent and falls back to the current route-only behavior for legacy or stale data.

**Tech Stack:** Vanilla JavaScript, existing reader library state module, DOM scroll APIs, Node test runner, JSDOM, Vite.

## Global Constraints

- Do not add a page, modal, setting, toast, or other visible control.
- Preserve version-1 reader libraries and all progress objects without `readingPosition`.
- Scope positions to the active journey slot.
- Never restore a phone view whose referenced App or chat no longer exists.
- Do not replay the article typing effect while restoring a saved passage.
- Debounce scroll-driven storage writes and flush on leaving the reader or hiding the page.

---

### Task 1: Sanitize persisted reading positions

**Files:**
- Modify: `reader/reader-library-state.js`
- Test: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Consumes: article and phone progress objects passed to `saveReaderProgress`.
- Produces: normalized `progress.readingPosition` values returned by `readReaderLibrary` and `restoreArticleReadingState`.

- [ ] **Step 1: Write failing tests for article and phone positions**

Add assertions that article anchors and phone App/chat locations survive a storage round trip, while invalid or oversized values are discarded or bounded. Also assert that a legacy progress object without the field remains valid.

- [ ] **Step 2: Run the focused state test and verify failure**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: FAIL because `readingPosition` is not preserved.

- [ ] **Step 3: Add bounded normalizers**

Normalize article positions to `pathIndex`, `anchorIndex`, `viewportTop`, and `scrollY`. Normalize phone positions to `appType`, `view`, `itemId`, `contactIndex`, `scrollTop`, `anchorId`, and `anchorOffset`. Reject mismatched kinds and preserve `null` for legacy state.

- [ ] **Step 4: Run the focused state test**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: PASS.

### Task 2: Persist and restore article passages

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-precise-resume.test.mjs`

**Interfaces:**
- Consumes: existing `captureArticleReadingPosition`, `restoreArticleReadingPosition`, active work, and active slot progress.
- Produces: debounced `readingPosition` saves and a one-shot restore after article rendering.

- [ ] **Step 1: Write a failing browser-state test**

Open an article, mock an anchor and scroll position, flush the page lifecycle save, reopen the book, and assert `window.scrollTo` restores the anchor-relative position.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/reader-precise-resume.test.mjs`

Expected: FAIL because article position is not persisted.

- [ ] **Step 3: Add lifecycle persistence**

Capture article positions into `saveCurrentReaderProgress`, debounce window scroll writes, and flush before rendering home or on `pagehide`/hidden visibility. Store a pending position while loading the saved slot.

- [ ] **Step 4: Restore once after rendering**

Restore by path/anchor with absolute scroll fallback, consume the pending value, and suppress the typing effect for that resumed render.

- [ ] **Step 5: Run the focused test**

Run: `node --test tests/reader-precise-resume.test.mjs`

Expected: PASS.

### Task 3: Persist and restore phone conversations

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-precise-resume.test.mjs`

**Interfaces:**
- Consumes: standalone phone render, `openReaderApp`, `openReaderChat`, and the phone panel scroll containers.
- Produces: a validated active App/chat location plus anchor-relative chat scroll restoration.

- [ ] **Step 1: Extend the failing integration test**

Open a standalone phone work, enter a chat, set its message-area position, flush the lifecycle save, reopen the work, and assert the same chat and message position return.

- [ ] **Step 2: Track phone locations**

Set the current location on desktop, App list, and chat transitions. Capture the nearest visible message anchor and its offset, with `scrollTop` as fallback.

- [ ] **Step 3: Restore only valid destinations**

On phone render, reopen an existing App; for Messages, reopen the referenced chat only when its stable ID still exists. Restore its scroller after rendering, otherwise fall back to the App list or desktop.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/reader-precise-resume.test.mjs tests/reader-progress-persistence.test.mjs tests/reader-library-state.test.mjs`

Expected: PASS.

### Task 4: Regression and production verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed implementation.
- Produces: fresh evidence for compatibility and build safety.

- [ ] **Step 1: Run reader continuity regressions**

Run: `node --test tests/reader-reading-continuity.test.mjs tests/reader-progress-persistence.test.mjs tests/reader-precise-resume.test.mjs`

Expected: PASS.

- [ ] **Step 2: Verify the real UI at desktop and mobile widths**

Confirm article reopening lands at the saved passage, phone reopening lands inside the saved chat, deliberate back navigation clears the deeper location, and the console is clean.

- [ ] **Step 3: Run the full suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 4: Run production verification**

Run: `npm run build:verify`

Expected: exit code 0.

- [ ] **Step 5: Check the scoped diff**

Run: `git diff --check -- reader/reader-library-state.js reader/reader.js tests/reader-library-state.test.mjs tests/reader-precise-resume.test.mjs`

Expected: no whitespace errors.
