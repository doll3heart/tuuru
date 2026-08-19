# Reader Runtime Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Track progress with the checkboxes below.

**Goal:** Reduce the JavaScript parsed when the reader homepage opens, without changing reader output, saved data, navigation, message timing, or offline behavior.

**Architecture:** Keep the reader homepage and phone appearance runtime kernel in `reader/reader.js`. Move the phone/profile/per-app appearance editing workbench behind one cached dynamic import, loaded only after the reader activates an appearance control. Retain synchronous normalization and CSS application in the entry module so opening a work never waits for editor-only UI.

**Tech Stack:** Browser ES modules, Vite 6, Node test runner, jsdom.

## Global Constraints

- Do not change user-visible labels, controls, storage keys, saved-data formats, routes, rendering output, or message playback order.
- Do not add dependencies.
- Dynamic-import failure must clear its cached promise so a later click can retry.
- Keep the service worker's build-time precache behavior so the lazy workbench remains available offline.
- Measure the production reader entry and full initial dependency graph before and after.

---

### Task 1: Extract and lazy-load the reader appearance workbench

**Files:**
- Create: `reader/reader-appearance-workbench.js`
- Modify: `reader/reader.js`
- Modify: `tests/entry-loading-performance.test.mjs`
- Modify only affected source-contract tests under `tests/reader-phone-appearance-dialog.test.mjs`, `tests/reader-app-settings-dialog.test.mjs`, `tests/reader-article-appearance-dialog.test.mjs`, and `tests/reader-settings-touch-targets.test.mjs`.

- [x] First add a failing contract proving that `reader/reader.js` dynamically imports `./reader-appearance-workbench.js`, never statically imports it, and the new module exports phone appearance, profile, and per-app appearance entry points.
- [x] Keep runtime-critical appearance normalization, persistence, CSS application, phone preview, app defaults/styles, and call-background validation in `reader/reader.js`.
- [x] Move only editor-only phone appearance, reader profile, shared appearance modal/preview controls, and per-app settings UI into the new module.
- [x] Pass dependencies through an explicit runtime adapter rather than importing reader globals or duplicating state.
- [x] Preserve dialog cleanup, focus restoration, sessionStorage drafts, pointer listeners, `ResizeObserver`, upload validation, undo/reset, and all existing labels and controls.
- [x] Keep the unused legacy appearance panel outside the lazy public API; do not silently route users to it.
- [x] Add one cached `loadReaderAppearanceWorkbench()` helper whose rejected promise is cleared for a later retry.
- [x] At the existing delegated appearance/profile/per-app controls, await the workbench, preserve the original trigger, and show a recoverable reader toast if loading fails.
- [x] Do not load the workbench while rendering the reader homepage, bookshelf, article, phone home, chat, or forum.
- [x] Keep browser behavior tests pointed at `reader/reader.js`; only source-text assertions should also read the new module.
- [x] Run the entry-loading, phone appearance, reader profile, per-app appearance, article appearance, touch-target, navigation, and storage tests.
- [x] Write a report including exact commands, pass counts, affected files, self-review findings, and concerns.

### Task 2: Verify the production split and offline contract

**Files:**
- Verify production output under `dist/assets/`.
- Update this plan and `.superpowers/sdd/progress.md` after clean review.

- [x] Run `git diff --check`.
- [x] Run `npm test`.
- [x] Run `npm run build:verify`.
- [x] Confirm Vite emits a separate appearance-workbench chunk and that it is not a static dependency of the reader entry.
- [x] Confirm the generated service worker precaches the new chunk.
- [x] Record reader entry raw/gzip size and initial static dependency-graph raw/gzip size against the baseline: reader entry `533,582 B / 160,675 B gzip`; static JS graph `742,902 B / 231,360 B gzip`.
- [x] Smoke-test reader homepage, cached article, cached phone work, phone appearance, reader profile, per-app appearance settings, and author/reader switching with no console errors.

## Verification Record

- Final reader entry: `439,361 B / 135,052 B gzip` (`-94,221 B / -25,623 B gzip`, about `15.9%` less gzip than baseline).
- Final initial static JS graph: `648,681 B / 205,737 B gzip`, seven chunks (`-94,221 B / -25,623 B gzip`).
- Lazy workbench chunk: `100,818 B / 29,347 B gzip`; it is dynamically imported and included in the generated service-worker precache.
- Final full suite: `2,261/2,261` passing. `npm run build:verify` and the production Vite build both pass.
- Browser production smoke covered the reader shell, first-load double activation, phone appearance, reader profile, focus restoration, and author/reader switching. Existing integration suites cover cached article/phone works and per-App appearance settings.
