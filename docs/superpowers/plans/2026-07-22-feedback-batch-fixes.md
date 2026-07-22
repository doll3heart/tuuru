# Feedback Batch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the seven reported author/reader regressions and workflow gaps without changing existing work-file semantics or clearing browser storage.

**Architecture:** Keep work data backward-compatible and add small focused helpers for viewport menu placement and versioned local profile transport. Reuse the existing contact identity resolver for Moments, extend existing editors in place, and pass chapter identity explicitly when creating nodes. UI additions remain compact and use the current gray-pink controls.

**Tech Stack:** Vanilla JavaScript ES modules, localStorage, DOM APIs, Node test runner, Vite.

## Global Constraints

- Preserve all old work fields and fallbacks.
- Never clear IndexedDB or localStorage as part of a fix.
- Full local profile import must be explicit, versioned, validated, and must not silently overwrite an existing author or reader record.
- JSON and PNG work transport semantics must remain unchanged.
- Mobile controls must fit a 500 × 900 viewport and retain 44px touch targets where applicable.

---

### Task 1: Mobile message context-menu placement

**Files:**
- Create: `js/viewport-menu.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/viewport-menu.test.mjs`
- Test: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Produces: `placeFixedMenuWithinViewport(menu, point, viewport, margin)` returning clamped `{ left, top }`.

- [ ] Write tests covering right-edge, bottom-edge, and ordinary pointer coordinates.
- [ ] Run `node --test tests/viewport-menu.test.mjs tests/phone-message-editor.test.mjs` and confirm the new assertions fail.
- [ ] Render the context menu through a body-level fixed portal, measure it, clamp it to the visual viewport, and close it on resize/scroll/outside interaction.
- [ ] Give menu items a readable minimum width, wrapping-safe line height, and 44px minimum height.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Moments identity avatars

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `reader/reader.js`
- Test: `tests/contact-identity.test.mjs`
- Test: `tests/reader-contact-identity.test.mjs`
- Test: `tests/feedback-regressions.test.mjs`

**Interfaces:**
- Consumes: `resolveContactIdentity(phoneData, identityId, { surface: "messages" })` and the author-side `contactAvatar(contact, "messages")` fallback chain.

- [ ] Add failing source/runtime assertions proving Moments use message avatars and retain initial fallback.
- [ ] Run the focused tests and confirm failure.
- [ ] Replace author and reader Moments initial-only markup with the shared message identity/avatar resolution path.
- [ ] Re-run the focused tests.

### Task 3: Versioned author-and-reader local profile transport

**Files:**
- Create: `js/local-profile-transport.js`
- Modify: `js/pages/home.js`
- Modify: `css/styles.css`
- Test: `tests/local-profile-transport.test.mjs`
- Test: `tests/home-write-ui.test.mjs`

**Interfaces:**
- Produces: `serializeLocalProfile(storage, exportedAt)`, `inspectLocalProfile(text)`, and `mergeLocalProfile(storage, profile)`.
- Package format: `tuuru-local-profile`, version `1`, with explicit author database and allow-listed Tuuru/reader local settings.

- [ ] Write failing round-trip, malformed-package, unknown-version, work-ID-conflict, and reader-key-conflict tests.
- [ ] Run focused tests and confirm failure.
- [ ] Implement validation and non-destructive merge: conflicting author work IDs receive new IDs, conflicting reader keys are retained under imported records where structurally mergeable, and settings require explicit replacement confirmation.
- [ ] Add compact “整机搬家” export/import actions beside existing backup controls with private-data warning and reload only after a confirmed successful import.
- [ ] Re-run focused tests.

### Task 4: Editable placeholder display name

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Test: `tests/author-placeholder-preset-ui.test.mjs`
- Test: `tests/feedback-regressions.test.mjs`

**Interfaces:**
- Extends existing placeholder patches with `label: string`; old placeholders continue falling back to `"占位符"`.

- [ ] Add a failing test requiring an editable label input and saved `label` patch.
- [ ] Run focused tests and confirm failure.
- [ ] Replace the static card heading with an accessible compact display-name input and include it in pending collection and card save.
- [ ] Re-run focused tests.

### Task 5: Editable forum comment and memo times

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/phone-app-modal.test.mjs`
- Test: `tests/feedback-regressions.test.mjs`

**Interfaces:**
- Top-level comment editing persists `comment.time`; memo editing persists the authored input without generating a new current timestamp on ordinary saves.

- [ ] Add failing tests for comment time editing and memo time preservation.
- [ ] Run focused tests and confirm failure.
- [ ] Add the existing “显示时间（可选）” field to comment editing and a compact editable time field to memo rows.
- [ ] Update memo save to read the field and stop overwriting dates with `new Date()`.
- [ ] Re-run focused tests.

### Task 6: Tutorial concept route

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Adds searchable tutorial copy distinguishing a work chapter from placeholder `scene` replacement mode and explaining the legacy duplicated “第一章” label.

- [ ] Add failing search/content assertions for “场景和第一章有什么区别”.
- [ ] Run the resource test and confirm failure.
- [ ] Add a concrete route with exact click locations, expected effects, and a glossary entry linking both concepts.
- [ ] Re-run the resource test.

### Task 7: Add node inside a chapter

**Files:**
- Modify: `js/data.js`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Test: `tests/article-target-picker-integration.test.mjs`
- Test: `tests/article-editor-mobile-shell.test.mjs`

**Interfaces:**
- Extends `addNode(workId, afterId, chapterId)` while preserving old two-argument behavior and first-chapter fallback.

- [ ] Add failing data/UI tests for creating directly inside the chosen chapter.
- [ ] Run focused tests and confirm failure.
- [ ] Add “在本章添加节点” to each chapter action group and pass the chapter ID to `addNode`.
- [ ] Re-run focused tests.

### Task 8: Integrated verification and mobile review

**Files:**
- Test: `tests/work-transport-parity.test.mjs`
- Test: all touched test files

- [ ] Run all focused tests and `tests/work-transport-parity.test.mjs`.
- [ ] Run `git diff --check`.
- [ ] Run `npm run verify` and require zero failures.
- [ ] Inspect the author phone menu, home backup controls, placeholder card, memo editor, tutorial, and chapter actions at 500 × 900 with no horizontal overflow.
- [ ] Review `git diff --stat` and confirm `.vite-8765.log` remains untouched.
