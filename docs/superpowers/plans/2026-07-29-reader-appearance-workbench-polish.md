# Reader Appearance Workbench Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every reader appearance workbench faster to operate by connecting preview elements to settings, surfacing changed-state summaries, supporting one-step undo and exact numeric entry, adding message-bubble style copy, and making local image uploads size-aware.

**Architecture:** Add shared workbench helpers in `reader/reader.js` for section targeting, summaries, draft history, numeric range enhancement, and image inspection/compression. Bind those helpers to the existing article, phone, profile, and App appearance dialogs without changing persisted schemas. Keep all upload processing local in the browser and preserve the original image unless the user explicitly chooses the compressed result.

**Tech Stack:** Browser-native JavaScript, HTML `details`, Canvas, existing Tuuru CSS tokens, Node test runner, JSDOM.

## Global Constraints

- Keep existing storage schemas and previously saved appearance data compatible.
- Do not send image data to any API or network service.
- Preserve desktop preview-left/settings-right and mobile preview/settings page behavior.
- Do not commit, push, or deploy unless the user asks.

---

### Task 1: Shared workbench interaction helpers

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `bindReaderAppearanceWorkbench(root, options)`
- Produces: `enhanceReaderAppearanceRanges(root, onCommit)`
- Produces: `focusReaderAppearanceSection(root, sectionId, controlSelector)`

- [ ] Write failing tests asserting preview targets open the mapped section, switch the mobile pager to settings, and focus the mapped control.
- [ ] Add semantic preview target attributes and the shared workbench binder.
- [ ] Add compact focus/highlight styling with reduced-motion support.
- [ ] Run the targeted App appearance tests.

### Task 2: Section summaries and modified markers

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`
- Test: `tests/reader-article-appearance-dialog.test.mjs`

**Interfaces:**
- Produces: section summaries via `data-appearance-summary`
- Consumes: each dialog's current and initial draft snapshots

- [ ] Write failing tests for summary text and modified markers.
- [ ] Extend section summaries with an accessible state label.
- [ ] Refresh summaries after inputs, buttons, uploads, resets, and undo.
- [ ] Run all appearance-dialog tests.

### Task 3: One-step draft undo

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`
- Test: `tests/reader-article-appearance-dialog.test.mjs`

**Interfaces:**
- Produces: one shared `.appearance-workbench-undo` action per dialog
- Consumes: dialog-specific snapshot and restore callbacks

- [ ] Write failing tests proving the most recent committed change is restored without saving.
- [ ] Add bounded one-step draft history with coalesced slider gestures.
- [ ] Bind undo to App, phone, profile, and article workbenches.
- [ ] Run appearance-dialog tests.

### Task 4: Exact numeric range entry

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`
- Test: `tests/reader-article-appearance-dialog.test.mjs`

**Interfaces:**
- Produces: numeric inputs linked to each range by `data-appearance-range-input`

- [ ] Write failing tests for clamping, step rounding, Enter commit, and Escape restore.
- [ ] Upgrade App, phone, and article range outputs into exact numeric controls.
- [ ] Preserve existing range input/change events and output units.
- [ ] Run appearance-dialog tests.

### Task 5: Message bubble style copy

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `data-cu-copy-bubble-style="self-to-other|other-to-self"`

- [ ] Write failing tests covering colors, radius, skin image, mode, size, slice, and padding.
- [ ] Add copy actions to both message bubble subsections.
- [ ] Apply the copied draft through existing controls and make it undoable.
- [ ] Run message appearance tests.

### Task 6: Local image inspection and optional compression

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `inspectReaderAppearanceImage(dataUrl, originalBytes)`
- Produces: `compressReaderAppearanceImage(dataUrl, options)`
- Produces: upload state text including dimensions, file size, transparent-edge status, and compression choice

- [ ] Write failing tests for byte formatting, transparent-edge reporting, original preservation, and optional compression.
- [ ] Inspect images locally after decode and report useful metadata.
- [ ] Offer “保持原图 / 压缩存储” only when compression is beneficial.
- [ ] Reuse the flow for bubble skins, chat wallpaper, and call background uploads.
- [ ] Run upload security and appearance tests.

### Task 7: Responsive visual QA and regression verification

**Files:**
- Modify if required: `reader/reader.css`
- Test: all existing tests

**Interfaces:**
- Consumes: all helpers and dialog bindings from Tasks 1–6

- [ ] Verify desktop preview targeting and collapsed summaries in the in-app browser.
- [ ] Verify mobile preview/settings switching, focus handoff, undo, and exact inputs at 390×844.
- [ ] Run `node --check reader/reader.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run build:verify`.
- [ ] Run `git diff --check` on changed files.
