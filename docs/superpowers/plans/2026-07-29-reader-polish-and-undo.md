# Reader Polish and Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing reader appearance workflow with local wallpaper readability protection, honest draft state, press-and-hold comparison, and reversible destructive actions.

**Architecture:** Extend the existing reader message settings and shared feedback center instead of adding new navigation or modal types. Keep appearance edits as modal-local drafts until Save, derive wallpaper contrast locally in the browser, and restore deleted reader data through focused immutable library-state helpers. Reuse the author bulk-operation snapshot store for immediate toast undo.

**Tech Stack:** Vanilla JavaScript ES modules, CSS custom properties, Canvas 2D image sampling, JSDOM/Node test runner, Vite.

## Global Constraints

- Do not upload wallpaper images or call an AI/API; all analysis stays in the browser.
- Do not add a new top-level entry, tab, or permanent toolbar.
- Appearance changes remain draft-only until Save.
- Undo must not overwrite unrelated reader-library changes.
- Motion must respect `prefers-reduced-motion`.

---

### Task 1: Local wallpaper readability

**Files:**
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `readerChatReadabilityPresentation(settings)` returning timestamp, composer surface, input surface, ink, line, and placeholder colors.
- Produces: `measureReaderChatBackgroundLuminance(dataUrl, fallbackColor)` returning `Promise<number>`.
- Persists: `chatAutoReadability:boolean` and `chatBgLuminance:number|null`.

- [ ] **Step 1: Write failing presentation and settings tests**

```js
assert.equal(previewChat.style.getPropertyValue("--chat-time-color"), "#ffffff")
assert.equal(document.getElementById("cuChatAutoReadability").checked, true)
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test --test-name-pattern="readability" tests/reader-app-settings-dialog.test.mjs`

Expected: FAIL because the toggle and readability variables do not exist.

- [ ] **Step 3: Implement local sampling and CSS variables**

```js
function readerChatReadabilityPresentation(settings) {
  const luminance = composedReaderChatLuminance(settings)
  return luminance < 0.46
    ? { time:"#fff", surface:"rgba(28,24,29,.9)", ink:"#fff" }
    : { time:"#40383b", surface:"rgba(255,250,250,.94)", ink:"#241d20" }
}
```

Add the unobtrusive “自动保障文字清晰” checkbox to the existing chat-background group, sample accepted local raster images with a small canvas, and map the derived palette into runtime and preview custom properties.

- [ ] **Step 4: Run focused tests**

Run: `node --test --test-name-pattern="readability" tests/reader-app-settings-dialog.test.mjs`

Expected: PASS.

### Task 2: Honest appearance draft state

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Extends: `openCuModal(..., options)` with a modal-local close guard and force-close path.
- Produces: modal draft signature containing normalized settings and icon draft.

- [ ] **Step 1: Write failing dirty-state tests**

```js
assert.equal(saveButton.disabled, true)
slider.value = "15"
slider.dispatchEvent(new Event("input", { bubbles:true }))
assert.equal(saveButton.disabled, false)
assert.match(status.textContent, /未保存/)
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test --test-name-pattern="dirty draft" tests/reader-app-settings-dialog.test.mjs`

Expected: FAIL because Save is initially enabled and close is unguarded.

- [ ] **Step 3: Implement canonical draft comparison**

Keep icon uploads and resets in modal-local variables, disable Save when the canonical draft equals the opening snapshot, and use the existing feedback center to offer “放弃修改” when the user closes a dirty modal.

- [ ] **Step 4: Run focused tests**

Run: `node --test --test-name-pattern="dirty draft" tests/reader-app-settings-dialog.test.mjs`

Expected: PASS.

### Task 3: Press-and-hold original comparison

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: the opening appearance snapshot from Task 2.
- Produces: `.is-comparing-original` state on the appearance workbench.

- [ ] **Step 1: Write a failing hold-comparison test**

```js
preview.dispatchEvent(pointer("pointerdown", 20, 20))
timers.runHold()
assert.equal(dialog.classList.contains("is-comparing-original"), true)
document.dispatchEvent(pointer("pointerup", 20, 20))
assert.equal(dialog.classList.contains("is-comparing-original"), false)
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test --test-name-pattern="hold comparison" tests/reader-app-settings-dialog.test.mjs`

Expected: FAIL because the comparison state does not exist.

- [ ] **Step 3: Implement the bounded hold gesture**

Start comparison after a 220 ms stationary primary-pointer hold, cancel when movement exceeds 6 px, restore the draft on pointerup/cancel, and expose the same comparison while Space is held on the preview frame. Add a short status hint without adding a permanent control.

- [ ] **Step 4: Run focused tests**

Run: `node --test --test-name-pattern="hold comparison" tests/reader-app-settings-dialog.test.mjs`

Expected: PASS.

### Task 4: Unified reversible actions

**Files:**
- Modify: `reader/reader-library-state.js`
- Modify: `reader/reader.js`
- Modify: `js/pages/home.js`
- Test: `tests/reader-library-state.test.mjs`
- Test: `tests/reader-bookshelf-ui.test.mjs`
- Test: `tests/home-bulk-undo-ui.test.mjs`

**Interfaces:**
- Produces: `restoreReaderBookmark(library, workId, bookmark)`.
- Produces: `restoreReaderBook(library, book)`.
- Reuses: `showReaderToast`, `showToast`, and `homeBulkUndoStore`.

- [ ] **Step 1: Write failing immutable restore tests**

```js
const restored = restoreReaderBookmark(removed, "work-a", bookmark)
assert.equal(readerBook(restored, "work-a").bookmarks[0].id, bookmark.id)
assert.deepEqual(otherBook(restored), otherBook(removed))
```

- [ ] **Step 2: Run state tests and confirm failure**

Run: `node --test --test-name-pattern="restore reader" tests/reader-library-state.test.mjs`

Expected: FAIL because restore helpers are not exported.

- [ ] **Step 3: Implement focused restore helpers and feedback actions**

Restore only the missing bookmark/book, preserve unrelated library records, keep a removed work’s cached raw package in memory for the toast window, and add immediate “撤销” actions for reader bookmark deletion, bookshelf removal, appearance reset, author find/replace, and author time shifting.

- [ ] **Step 4: Run focused UI and state tests**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-bookshelf-ui.test.mjs tests/home-bulk-undo-ui.test.mjs`

Expected: PASS.

### Task 5: Visual and production verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `css/phone-chat.css`

- [ ] **Step 1: Run the complete affected test set**

Run: `node --test tests/reader-app-settings-dialog.test.mjs tests/reader-library-state.test.mjs tests/reader-bookshelf-ui.test.mjs tests/home-bulk-undo-ui.test.mjs tests/home-bulk-undo.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 2: Run production verification**

Run: `npm run build:verify`

Expected: exit code 0.

- [ ] **Step 3: Inspect the real reader at desktop and mobile widths**

Confirm dark and light wallpaper samples produce readable timestamps/composers, dirty close offers a reversible discard path, hold comparison restores the draft on release, and toast actions remain reachable without covering primary controls.
