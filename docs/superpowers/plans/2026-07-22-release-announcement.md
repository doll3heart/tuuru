# One-Time Release Announcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one accessible system announcement on the first visit after a major Tuuru release, then keep it dismissed for that browser until the announcement ID changes.

**Architecture:** A dependency-injected shared ES module owns the current announcement record, its isolated localStorage acknowledgement key, and the accessible dialog lifecycle. The author and reader entry points call the same opener after their normal first render, so one acknowledgement applies across both surfaces on the same origin. Each surface supplies matching gray-pink CSS without touching work storage.

**Tech Stack:** Browser ES modules, DOM APIs, localStorage, CSS, Node test runner, JSDOM.

## Global Constraints

- Never read, rewrite, migrate, or delete `tuuru_works`, `moirain_work_*`, IndexedDB, or any work payload.
- Store only the latest acknowledged announcement ID under `tuuru_release_announcement_seen`.
- A changed announcement `id` is the explicit release switch; ordinary code deployments do not reopen an unchanged announcement.
- Show only outside editor-preview mode and only after the active surface has rendered.
- Closing by the primary button, close button, backdrop, or Escape acknowledges the current ID.
- Storage failures must not block access to Tuuru or crash either entry point.
- Preserve the existing gray-pink component language and 44px touch targets.
- Do not commit, push, deploy, or clean the existing dirty worktree without explicit user instruction.

---

### Task 1: Shared announcement state and dialog lifecycle

**Files:**
- Create: `js/release-announcement.js`
- Test: `tests/release-announcement.test.mjs`

**Interfaces:**
- Produces: `RELEASE_ANNOUNCEMENT_STORAGE_KEY`, `CURRENT_RELEASE_ANNOUNCEMENT`, `shouldShowReleaseAnnouncement(options)`, `acknowledgeReleaseAnnouncement(options)`, and `showReleaseAnnouncementOnce(options)`.
- Consumes: injected `storage`, `document`, and optional `announcement` values; defaults to browser globals.

- [ ] **Step 1: Write failing state and lifecycle tests**

```js
assert.equal(shouldShowReleaseAnnouncement({ storage, announcement }), true)
const overlay = showReleaseAnnouncementOnce({ document, storage, announcement })
overlay.querySelector("[data-release-announcement-confirm]").click()
assert.equal(storage.getItem(RELEASE_ANNOUNCEMENT_STORAGE_KEY), announcement.id)
assert.equal(showReleaseAnnouncementOnce({ document, storage, announcement }), null)
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `node --test tests/release-announcement.test.mjs`

Expected: FAIL because `js/release-announcement.js` does not exist.

- [ ] **Step 3: Implement the shared release switch and dialog**

```js
export const RELEASE_ANNOUNCEMENT_STORAGE_KEY = "tuuru_release_announcement_seen"
export const CURRENT_RELEASE_ANNOUNCEMENT = Object.freeze({
  id: "2026-07-22-social-writing-tools",
  title: "Tuuru 更新公告",
  publishedAt: "2026-07-22",
  intro: "这次更新补齐了人物社交、写作习惯和内置教程。",
  items: Object.freeze([]),
})
```

Build dialog nodes with `textContent`, `role="dialog"`, `aria-modal="true"`, labelled title, focus restoration, Escape/backdrop dismissal, and one idempotent close function which attempts the isolated acknowledgement write inside `try/catch`.

- [ ] **Step 4: Run the shared module tests**

Run: `node --test tests/release-announcement.test.mjs`

Expected: all announcement tests pass.

### Task 2: Author and reader entry integration

**Files:**
- Modify: `js/app.js`
- Modify: `reader/reader.js`
- Test: `tests/release-announcement.test.mjs`

**Interfaces:**
- Consumes: `showReleaseAnnouncementOnce()` from Task 1.
- Produces: one post-render call on each standalone entry surface.

- [ ] **Step 1: Add failing source integration assertions**

```js
assert.match(authorSource, /showReleaseAnnouncementOnce\(\)/)
assert.match(readerSource, /if \(!_editorPreviewMode\)[\s\S]*showReleaseAnnouncementOnce\(\)/)
```

- [ ] **Step 2: Run the test and verify the integration assertions fail**

Run: `node --test tests/release-announcement.test.mjs`

Expected: FAIL because neither entry point imports or calls the shared opener.

- [ ] **Step 3: Call the announcement after normal first render**

```js
import { showReleaseAnnouncementOnce } from "./release-announcement.js"
// After initRouter(app):
showReleaseAnnouncementOnce()
```

In `reader/reader.js`, import from `../js/release-announcement.js` and call only after standalone `renderHome()`, never for editor preview.

- [ ] **Step 4: Run the integration tests**

Run: `node --test tests/release-announcement.test.mjs`

Expected: all source and runtime tests pass.

### Task 3: Responsive gray-pink presentation and final verification

**Files:**
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Test: `tests/release-announcement.test.mjs`

**Interfaces:**
- Consumes: `.release-announcement-*` class names from Task 1.
- Produces: matching author/reader presentation with mobile-safe scrolling and touch targets.

- [ ] **Step 1: Add failing CSS contract assertions**

```js
for (const css of [authorCss, readerCss]) {
  assert.match(css, /\.release-announcement-overlay/)
  assert.match(css, /\.release-announcement-confirm[^}]*min-height\s*:\s*44px/s)
}
```

- [ ] **Step 2: Run the CSS contract test and verify it fails**

Run: `node --test tests/release-announcement.test.mjs`

Expected: FAIL because the shared dialog classes are not styled.

- [ ] **Step 3: Add the shared visual vocabulary to both stylesheets**

```css
.release-announcement-overlay { position: fixed; inset: 0; display: flex; }
.release-announcement-dialog { width: min(520px, 100%); max-height: min(720px, 90vh); }
.release-announcement-confirm { min-height: 44px; }
```

Use existing surface, text, border, and primary tokens; keep content scrollable inside safe-area padding on narrow screens.

- [ ] **Step 4: Run targeted and full verification**

Run: `node --test tests/release-announcement.test.mjs`

Expected: all targeted tests pass.

Run: `npm run verify`

Expected: all tests, TypeScript checks, and the Vite production build pass.

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 5: Visually inspect desktop and 500px mobile widths**

Open `/#/` and `/reader/` with the acknowledgement key absent. Confirm the dialog is readable, the close controls are reachable, the page does not overflow horizontally, and reopening after acknowledgement does not show it again.

## Self-Review

- Spec coverage: the release ID controls recurrence; author and reader share one acknowledgement; every dismissal path is covered; work storage is isolated; responsive and accessible presentation is specified.
- Placeholder scan: no TBD/TODO steps remain.
- Type consistency: all tasks use the same announcement field names and exported function signatures.
