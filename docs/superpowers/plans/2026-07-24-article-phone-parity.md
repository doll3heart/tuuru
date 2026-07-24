# Article Phone Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make article-embedded phone modules render and behave through the same author and reader phone UI contracts as their standalone-phone counterparts.

**Architecture:** Preserve the existing one-card-per-App module data and navigation boundary, but mount the author App editor inside a real `.phone-frame` carrying the same skin variables as the standalone editor. On the reader side, retain the shared `buildPhoneHTML`/`openReaderApp` component renderer while keeping App back as the intentional exit from the single-App article card.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node test runner, JSDOM.

## Global Constraints

- The standalone author phone is the visual and interaction source of truth for author article phone modules.
- The standalone reader phone is the visual and interaction source of truth for reader article phone modules.
- Do not modify interactive-image / interactive-scene files or behavior.
- Preserve the existing per-App module save format so unrelated App data is not written into a module.
- Preserve the current responsive UI conventions and 44px modal controls.

---

### Task 1: Author App editor phone-frame parity

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/phone-app-modal-layout.test.mjs`

**Interfaces:**
- Consumes: `openPhoneAppModal(wid, appType, options)` and the existing `phoneData.skin`.
- Produces: a `.phone-app-modal-frame.phone-frame` host with the same CSS custom properties and scoped App styles as the standalone author phone.

- [ ] **Step 1: Write the failing DOM and CSS assertions**

Assert that App modal content contains a `.phone-frame`, that the frame carries wallpaper/frame/font/radius variables, and that modal layout allows the framed phone to fill the available viewport without a second scrolling surface.

- [ ] **Step 2: Run the targeted test and confirm it fails**

Run: `node --test tests/phone-app-modal-layout.test.mjs`

Expected: FAIL because the modal currently renders directly into `.phone-app-modal-content`.

- [ ] **Step 3: Add the shared frame-skin helper and mount the App editor into it**

Create a focused helper in `js/pages/phone.js` that applies the standalone phone frame class and skin CSS variables. Keep the modal close controller on the App frame so existing App back buttons retain the module-save-and-close lifecycle.

- [ ] **Step 4: Add responsive framed-modal CSS**

Make the modal inner shell a transparent structural host when it contains a phone frame, and make the phone frame fill the bounded modal while retaining the standalone border, radius, font, colors, and App-scoped styles.

- [ ] **Step 5: Run the targeted test**

Run: `node --test tests/phone-app-modal-layout.test.mjs tests/phone-app-modal.test.mjs`

Expected: PASS.

### Task 2: Reader single-App parity verification

**Files:**
- Verify: `reader/reader.js`
- Test: `tests/reader-critical-flow.test.mjs`
- Test: `tests/acceptance-sample-works.test.mjs`

**Interfaces:**
- Consumes: the shared `buildPhoneHTML`/`openReaderApp` renderer.
- Produces: evidence that article cards open the same reader App component directly and that App back exits the one-App card as designed.

- [ ] **Step 1: Run reader critical-flow and acceptance tests**

Run: `node --test tests/reader-critical-flow.test.mjs tests/acceptance-sample-works.test.mjs`

Expected: PASS with the existing one-card-per-App close behavior.

### Task 3: Cross-surface verification

**Files:**
- Verify only; do not touch interactive-image / interactive-scene files.

**Interfaces:**
- Consumes: the author modal and reader overlay parity changes.
- Produces: regression evidence for DOM structure, CSS scope, module lifecycle, reader navigation, build output, and responsive browser behavior.

- [ ] **Step 1: Run phone and article-module tests**

Run the phone modal, phone forum, article phone module, and new parity tests.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all phone parity tests pass; report any unrelated pre-existing failures separately with exact names.

- [ ] **Step 3: Run the production build verification**

Run: `npm run build:verify`

Expected: exit code 0.

- [ ] **Step 4: Check the diff boundary**

Run `git diff --check` and inspect `git diff` for only the planned phone-parity files plus the plan/test files. Confirm no interactive-image / interactive-scene file was edited.

- [ ] **Step 5: Browser-check desktop and narrow layouts**

Open an author article phone module and a reader article phone module, compare App detail presentation to each standalone phone, confirm the forum/chat/shopping scoped styles apply, verify App back and overlay close behavior, and check for horizontal overflow or console errors.
