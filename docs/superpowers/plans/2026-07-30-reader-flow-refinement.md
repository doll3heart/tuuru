# Reader Flow Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing reader feel frictionless by giving browser Back a predictable layer order, remembering approved character-device access per reading slot, restoring accidentally closed appearance drafts, and deferring expensive offscreen media rendering.

**Architecture:** Add three small state helpers for browser-history layers, slot-scoped phone access, and in-tab appearance drafts, then connect them to the existing reader runtime without changing exported work files. Performance work remains progressive enhancement: native lazy image decoding, pre-decoded backgrounds, and CSS viewport containment preserve current content and interaction semantics.

**Tech Stack:** Browser History API, JavaScript ES modules, local reader-library JSON state, DOM/CSS, Node test runner with JSDOM.

## Global Constraints

- Do not add a new permanent navigation entry or reader setting.
- Preserve existing reading progress, placeholder, identity, bookmark, and appearance storage.
- A changed author-assigned contact must require confirmation again.
- Appearance drafts live only in the current tab and expire automatically.
- Performance enhancements must not remove messages, photos, or authored interactions from the DOM.

---

### Task 1: Layer-aware browser Back

**Files:**
- Create: `reader/reader-layer-history.js`
- Modify: `reader/reader.js`
- Test: `tests/reader-layer-history.test.mjs`
- Test: `tests/reader-home-navigation.test.mjs`

**Interfaces:**
- Produces: `createReaderLayerHistory(window)` with `open(key, onClose)`, `close(key)`, `has(key)`, and `dispose()`.
- Consumes: Existing close callbacks for import, bookshelf management, search, appearance dialogs, phone apps, and phone detail pages.

- [ ] **Step 1: Write failing unit tests**

Test that opening two layers pushes two history entries, browser Back closes only the newest layer, manual close removes its matching history entry without invoking an older layer, and duplicate opens update rather than duplicate a layer.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/reader-layer-history.test.mjs`

Expected: FAIL because `reader/reader-layer-history.js` does not exist.

- [ ] **Step 3: Implement the history controller**

Use opaque monotonic tokens in `history.state.__tuuruReaderLayer`, keep close callbacks in memory, and suppress the single `popstate` emitted by a manual `history.back()`.

- [ ] **Step 4: Connect existing reader layers**

Register the search, import dialog, book manager, article appearance panel, shared appearance modal, phone app, and chat/forum detail surfaces. Existing close buttons call the same layer controller so focus restoration and browser Back share one path.

- [ ] **Step 5: Run navigation tests**

Run: `node --test tests/reader-layer-history.test.mjs tests/reader-home-navigation.test.mjs tests/phone-app-back-standalone.test.mjs tests/reader-phone-accessibility.test.mjs`

Expected: all tests pass.

### Task 2: Slot-scoped phone connection approval

**Files:**
- Modify: `reader/reader-library-state.js`
- Modify: `reader/reader.js`
- Test: `tests/reader-library-state.test.mjs`
- Test: `tests/reader-contact-context.test.mjs`

**Interfaces:**
- Produces: `rememberReaderPhoneAccess(library, workId, appType, contactId, now)` and normalized `phoneAccess` on each reading slot.
- Consumes: Active book slot and authored `phoneData.appConnections`.

- [ ] **Step 1: Write failing state tests**

Test that approval is stored only on the active slot, survives normalization and persistence, does not leak to a new slot, and rejects invalid identifiers.

- [ ] **Step 2: Run the focused state tests**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-contact-context.test.mjs`

Expected: FAIL because slot phone access is not represented.

- [ ] **Step 3: Add normalized slot access state**

Normalize a bounded app-type-to-contact-id record, mirror it only through the slot, initialize it for legacy and new slots, and export the mutation helper.

- [ ] **Step 4: Use approval when opening locked phone apps**

Skip the connection gate only when the active slot contains the same app/contact pair currently assigned by the author. Persist the pair on confirmation; an author change naturally invalidates the old pair.

- [ ] **Step 5: Run phone access tests**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-contact-context.test.mjs tests/reader-phone-module-contact-visibility.test.mjs tests/phone-character-access.test.mjs`

Expected: all tests pass.

### Task 3: Recover accidentally closed appearance drafts

**Files:**
- Create: `reader/appearance-draft-session.js`
- Modify: `reader/reader.js`
- Test: `tests/reader-appearance-draft-session.test.mjs`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `readAppearanceDraft(key)`, `writeAppearanceDraft(key, value)`, and `clearAppearanceDraft(key)`.
- Consumes: Existing phone, profile, and per-App appearance snapshot/restore functions.

- [ ] **Step 1: Write failing draft tests**

Test defensive cloning, expiry after thirty minutes, replacement by key, and explicit clearing.

- [ ] **Step 2: Run the focused draft test**

Run: `node --test tests/reader-appearance-draft-session.test.mjs`

Expected: FAIL because the draft session module does not exist.

- [ ] **Step 3: Implement an in-memory expiring draft store**

Store cloned plain data in the module, reject empty keys and non-serializable values, and never write data URLs to localStorage or exported reader data.

- [ ] **Step 4: Connect appearance workbenches**

Restore a valid draft when phone, profile, or per-App appearance opens; update it after controls change; clear it after Save or explicit reset-to-persisted; and retain it when closing through Escape, Back, backdrop, or Cancel. Article appearance remains unchanged because it already auto-saves each valid adjustment.

- [ ] **Step 5: Run appearance tests**

Run: `node --test tests/reader-appearance-draft-session.test.mjs tests/reader-phone-appearance-dialog.test.mjs tests/reader-app-settings-dialog.test.mjs tests/reader-article-appearance-dialog.test.mjs`

Expected: all tests pass.

### Task 4: Progressive media and chat rendering

**Files:**
- Create: `reader/reader-media-loading.js`
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-media-loading.test.mjs`
- Test: `tests/reader-phone-gallery.test.mjs`
- Test: `tests/reader-chat-choice-runtime.test.mjs`

**Interfaces:**
- Produces: `readerImageAttributes({ eager })` for safe native loading hints and `predecodeReaderImage(url, ImageCtor)` for non-blocking wallpaper readiness.
- Consumes: Existing gallery, avatar, wallpaper, chat-background, and bubble-skin URLs.

- [ ] **Step 1: Write failing helper tests**

Test safe lazy/async attributes, eager exceptions for above-the-fold assets, successful decode, load fallback, and harmless rejection.

- [ ] **Step 2: Run the focused media test**

Run: `node --test tests/reader-media-loading.test.mjs`

Expected: FAIL because the media helper does not exist.

- [ ] **Step 3: Add progressive media helpers**

Generate fixed native attributes and return a promise that resolves after `HTMLImageElement.decode()` or load/error fallback without blocking UI.

- [ ] **Step 4: Apply loading hints and containment**

Mark gallery and long-feed images lazy with async decoding, keep current avatars and active previews eager, predecode wallpaper/background candidates before swapping them, and add `content-visibility:auto` plus intrinsic-size containment to offscreen chat/feed items.

- [ ] **Step 5: Run media and runtime tests**

Run: `node --test tests/reader-media-loading.test.mjs tests/reader-phone-gallery.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-call-playback.test.mjs`

Expected: all tests pass.

### Task 5: Full verification

**Files:**
- Verify all modified source and test files.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: A buildable reader with no regression in existing author or reader flows.

- [ ] **Step 1: Run the reader-focused suite**

Run: `node --test tests/reader-*.test.mjs tests/phone-app-back-standalone.test.mjs tests/phone-character-access.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run build verification**

Run: `npm run build:verify`

Expected: TypeScript and both verified builds succeed.

- [ ] **Step 3: Review the diff**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors; only planned source, test, and plan files are changed.
