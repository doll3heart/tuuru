# Reader Custom Decoration Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers upload decorative raster images, automatically map each image to a `2×2`, `4×3`, or `8×3` phone-home footprint, and add the result as a draggable desktop component.

**Architecture:** Fixed V7 store products remain unchanged. Custom decorations live in a separate normalized `desktopWidgets.customDecorations` collection and use `custom:<id>` home-layout keys, so fixed catalog validation cannot discard them. The appearance workbench reads and verifies the local image, measures its aspect ratio, chooses a footprint, adds it to the normalized home layout, and renders it with `object-fit: contain`.

**Tech Stack:** Browser ES modules, DOM event delegation, CSS custom properties, Node test runner, JSDOM integration tests.

## Global Constraints

- Support PNG, JPEG, and WebP uploads only; reuse the existing verified local-image reader and 2 MiB file ceiling.
- Keep uploaded decorations local to reader appearance data and include them in appearance-package export/import.
- Never stretch or crop uploaded art; render with `object-fit: contain` and a transparent surface.
- Preserve fixed V7 product count, categories, IDs, and behavior.
- Custom decorations are non-interactive visual components and remain draggable across phone screens.
- Store no more than eight custom decorations and normalize malformed, duplicate, unsafe, or oversized records away.

---

### Task 1: Normalize custom decoration records and size matching

**Files:**
- Modify: `reader/phone-desktop-widgets.js`
- Test: `tests/reader-phone-desktop-widgets.test.mjs`

**Interfaces:**
- Produces: `PHONE_CUSTOM_DECORATION_SIZES`, `PHONE_CUSTOM_DECORATION_MAX_ITEMS`, `phoneCustomDecorationSizeForDimensions(width, height)`, `renderPhoneCustomDecoration(candidate, id)`, and normalized `desktopWidgets.customDecorations` records shaped as `{ id, name, image, size }`.
- Consumes: existing `isSafeImageUrl`, `escapeHtmlAttribute`, `safeText`, and `normalizePhoneDesktopWidgets` conventions.

- [ ] **Step 1: Write failing model tests**

```js
assert.equal(phoneCustomDecorationSizeForDimensions(600, 800), "small")
assert.equal(phoneCustomDecorationSizeForDimensions(1200, 900), "half")
assert.equal(phoneCustomDecorationSizeForDimensions(1600, 600), "wide")
assert.deepEqual(normalizePhoneDesktopWidgets({ customDecorations:[valid, duplicate, unsafe] }).customDecorations, [valid])
```

- [ ] **Step 2: Run the focused model test and confirm it fails**

Run: `node --test tests/reader-phone-desktop-widgets.test.mjs`

Expected: FAIL because the custom-decoration exports and normalized collection do not exist.

- [ ] **Step 3: Implement the normalized custom-decoration model**

```js
export const PHONE_CUSTOM_DECORATION_SIZES = Object.freeze([
  Object.freeze({ id:"small", label:"2 × 2 格", width:2, height:2 }),
  Object.freeze({ id:"half", label:"4 × 3 格", width:4, height:3 }),
  Object.freeze({ id:"wide", label:"8 × 3 格", width:8, height:3 }),
])

export function phoneCustomDecorationSizeForDimensions(width, height) {
  const ratio = Number(width) / Number(height)
  if (!Number.isFinite(ratio) || ratio <= 0) return "half"
  if (ratio >= 1.65) return "wide"
  if (ratio >= 1.1) return "half"
  return "small"
}
```

Normalize up to eight unique `custom-...` IDs, accept embedded PNG/JPEG/WebP data URLs only, cap names at 40 characters, and coerce unknown sizes to `half`. Render custom decorations as non-button markup with an escaped image URL and accessible label.

- [ ] **Step 4: Run the focused model test**

Run: `node --test tests/reader-phone-desktop-widgets.test.mjs`

Expected: PASS.

### Task 2: Add custom footprints to the multi-screen home layout

**Files:**
- Modify: `reader/phone-home-layout.js`
- Test: `tests/reader-phone-home-layout.test.mjs`

**Interfaces:**
- Consumes: normalized `desktopWidgets.customDecorations` from Task 1.
- Produces: stable `custom:<id>` keys and exact `2×2`, `4×3`, or `8×3` footprints for normalization, dragging, collision handling, and cross-screen placement.

- [ ] **Step 1: Write failing home-layout tests**

```js
const definitions = phoneHomeDefinitions({ items:[], customDecorations:[
  { id:"custom-square123", size:"small", image:png },
  { id:"custom-half12345", size:"half", image:png },
  { id:"custom-wide12345", size:"wide", image:png },
] })
assert.deepEqual(definitions.slice(-3).map(phoneHomeFootprint), [
  { width:2, height:2 }, { width:4, height:3 }, { width:8, height:3 },
])
```

- [ ] **Step 2: Run the focused layout test and confirm it fails**

Run: `node --test tests/reader-phone-home-layout.test.mjs`

Expected: FAIL because custom layout definitions are absent.

- [ ] **Step 3: Implement custom home keys and footprints**

Extend `phoneHomeItemKey`, `phoneHomeFootprint`, and `phoneHomeDefinitions` without changing App, profile, or fixed-widget behavior. Custom items must participate in the existing collision and page-placement algorithms with no separate drag path.

- [ ] **Step 4: Run the focused layout test**

Run: `node --test tests/reader-phone-home-layout.test.mjs`

Expected: PASS.

### Task 3: Build the upload, auto-match, resize, and remove workflow

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`
- Test: `tests/reader-phone-grid.test.mjs`

**Interfaces:**
- Consumes: Task 1 size matcher and renderer; Task 2 custom home definitions.
- Produces: `[data-cu-custom-widget-upload]`, `[data-cu-custom-widget-size]`, and `[data-cu-custom-widget-remove]` workbench actions.

- [ ] **Step 1: Write failing workbench tests**

Assert that the phone appearance workspace renders an upload action with supported-format and auto-sizing copy, custom size controls use `aria-pressed`, and reader source wires upload, resize, deletion, home-layout normalization, and live feedback.

- [ ] **Step 2: Run the focused appearance tests and confirm they fail**

Run: `node --test tests/reader-phone-appearance-dialog.test.mjs tests/reader-phone-grid.test.mjs`

Expected: FAIL because custom upload controls and handlers are absent.

- [ ] **Step 3: Implement upload and workbench markup**

Add a compact upload row above “我的桌面”. On selection, call the existing verified file reader, measure decoded natural dimensions, create a collision-resistant `custom-...` ID, choose a size with `phoneCustomDecorationSizeForDimensions`, append the normalized record, and focus the screen where it was placed. Installed custom cards show the detected `N × M 格` size, a three-option accessible override, and a delete action.

- [ ] **Step 4: Implement phone rendering styles**

Use a transparent full-footprint wrapper and `img { width:100%; height:100%; object-fit:contain; }`. Match existing store control spacing, focus rings, mobile stacking, and reduced-motion behavior.

- [ ] **Step 5: Run the focused appearance tests**

Run: `node --test tests/reader-phone-appearance-dialog.test.mjs tests/reader-phone-grid.test.mjs`

Expected: PASS.

### Task 4: Preserve custom decorations in appearance migration

**Files:**
- Modify: `reader/appearance-package.js`
- Test: `tests/reader-appearance-package.test.mjs`

**Interfaces:**
- Consumes: normalized custom decoration records from Task 1.
- Produces: safe appearance-package export/import that keeps `{ id, name, image, size }` and matching `custom:<id>` home positions.

- [ ] **Step 1: Write a failing appearance-package round-trip test**

```js
assert.deepEqual(exported.phone.desktopWidgets.customDecorations, [customDecoration])
assert.deepEqual(exported.phone.homeLayout.items.find(item => item.key === `custom:${customDecoration.id}`), expectedPosition)
```

- [ ] **Step 2: Run the focused package test and confirm it fails**

Run: `node --test tests/reader-appearance-package.test.mjs`

Expected: FAIL because custom decoration assets are currently stripped.

- [ ] **Step 3: Export normalized custom decoration records**

Copy only the normalized `id`, `name`, `image`, and `size` fields into the phone appearance package before normalizing `homeLayout` against the combined fixed/custom definitions.

- [ ] **Step 4: Run the focused package test**

Run: `node --test tests/reader-appearance-package.test.mjs`

Expected: PASS.

### Task 5: Verify the complete feature

**Files:**
- Verify: `reader/phone-desktop-widgets.js`
- Verify: `reader/phone-home-layout.js`
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `reader/appearance-package.js`

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: browser-verified and regression-tested custom decoration upload behavior.

- [ ] **Step 1: Run all related tests**

Run: `node --test tests/reader-phone-desktop-widgets.test.mjs tests/reader-phone-home-layout.test.mjs tests/reader-phone-appearance-dialog.test.mjs tests/reader-phone-grid.test.mjs tests/reader-appearance-package.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 2: Verify in the real phone appearance workbench**

Upload one square image and one wide image, confirm automatic `2×2` and `8×3` matching, resize one through the three footprint buttons, drag a custom component to the bottom row and another screen, save, reopen, and confirm both image and positions persist.

- [ ] **Step 3: Run project verification**

Run: `npm run verify`

Expected: all Node tests, TypeScript checks, and production builds pass.

- [ ] **Step 4: Check patch hygiene**

Run: `git diff --check -- reader/phone-desktop-widgets.js reader/phone-home-layout.js reader/reader.js reader/reader.css reader/appearance-package.js tests/reader-phone-desktop-widgets.test.mjs tests/reader-phone-home-layout.test.mjs tests/reader-phone-appearance-dialog.test.mjs tests/reader-phone-grid.test.mjs tests/reader-appearance-package.test.mjs`

Expected: no whitespace errors.
