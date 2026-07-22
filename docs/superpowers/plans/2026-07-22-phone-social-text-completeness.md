# Phone Social Text Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align mobile work-card actions, add authored forum display metrics, replace dedicated mention buttons with automatic `@` pickers, make moment comment time editable, and substitute placeholders throughout reader-visible phone text.

**Architecture:** Keep authored data backward compatible by adding optional `displayCommentCount` and `displayFloor` fields with array-based fallbacks. Centralize mention detection at the phone App modal lifecycle and centralize reader phone placeholder substitution at the phone-data rendering boundary, both without mutating stored works.

**Tech Stack:** Vanilla JavaScript modules, CSS, Node test runner, JSDOM, Vite.

## Global Constraints

- Preserve all existing fields and local browser data.
- Optional new fields must fall back cleanly for old works.
- JSON and PNG transports must keep identical semantics.
- No screenshot testing for this batch; automated tests only.

---

### Task 1: Mobile work-card bottom alignment

**Files:**
- Modify: `css/styles.css`
- Test: `tests/author-shell-visual.test.mjs`

**Interfaces:**
- Produces: `.work-card` as a vertical flex container and `.work-card-body` as its flexible region.

- [ ] Add a failing CSS contract test proving card actions are anchored after a flexible body.
- [ ] Run `node --test tests/author-shell-visual.test.mjs` and confirm failure.
- [ ] Add `display:flex; flex-direction:column` to `.work-card` and `flex:1` to `.work-card-body`.
- [ ] Run the targeted test and confirm success.

### Task 2: Forum display metrics

**Files:**
- Create: `js/forum-display-metrics.js`
- Modify: `js/pages/phone.js`
- Modify: `reader/reader.js`
- Test: `tests/forum-display-metrics.test.mjs`
- Test: `tests/phone-social-choice-editor.test.mjs`
- Test: `tests/reader-social-choice-runtime.test.mjs`
- Test: `tests/work-transport-parity.test.mjs`

**Interfaces:**
- Produces: `forumDisplayCommentCount(post)` and `forumDisplayFloor(comment, fallbackFloor)`.

- [ ] Add failing unit tests for unset, zero, large, invalid, and legacy values.
- [ ] Implement non-negative integer normalization with actual-count/index fallbacks.
- [ ] Add author inputs for post `displayCommentCount` and root comment `displayFloor`.
- [ ] Use the helpers in author list/detail and reader list/detail rendering.
- [ ] Verify editor, reader runtime, and JSON/PNG parity tests.

### Task 3: Automatic phone mention picker

**Files:**
- Create: `js/phone-mention-trigger.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/phone-mention-trigger.test.mjs`
- Test: `tests/phone-message-editor.test.mjs`
- Test: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Produces: `isPhoneMentionInput(target)` and `bindPhoneMentionTrigger(root, openPicker)`.
- Consumes: contacts, contact aliases, forum NPCs, reader label, and work placeholder keys.

- [ ] Add failing tests for typed `@`, composition, excluded URL/number fields, cleanup, and repeated selection.
- [ ] Implement one delegated trigger bound to the phone App modal lifecycle.
- [ ] Build a searchable identity picker and insert the selected token after the typed `@`.
- [ ] Remove forum and group-chat dedicated mention buttons and their bindings.
- [ ] Verify messages, forum, moments, and other phone text inputs use the same trigger.

### Task 4: Moment comment authoring

**Files:**
- Modify: `js/pages/phone.js`
- Test: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Produces: moment comments with editable `content` and optional `time` while retaining existing choices.

- [ ] Add failing tests for authored time on creation and content/time editing.
- [ ] Add a visible time field to the reply modal.
- [ ] Add an edit control for existing moment comments and preserve choices/unknown fields.
- [ ] Verify save and rerender behavior.

### Task 5: Reader phone placeholder coverage

**Files:**
- Create: `js/phone-placeholder-text.js`
- Modify: `reader/reader.js`
- Test: `tests/phone-placeholder-text.test.mjs`
- Test: `tests/reader-contact-identity.test.mjs`
- Test: `tests/reader-social-choice-runtime.test.mjs`
- Test: `tests/work-transport-parity.test.mjs`

**Interfaces:**
- Produces: `substitutePhoneTextData(phoneData, placeholders, options)` returning a detached render copy.

- [ ] Add failing tests covering contact/NPC names, moment/forum/chat text, labels, dates, and nested replies/choices.
- [ ] Prove identifiers, URLs, media data, enum fields, and source objects remain unchanged.
- [ ] Apply the detached substituted phone data at desktop and App render boundaries.
- [ ] Verify mentions are highlighted after placeholder replacement.
- [ ] Run reader runtime and transport parity tests.

### Task 6: Tutorial and release verification

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Documents: forum display metrics, automatic `@` picker, moment comment time editing, and phone-wide placeholder replacement.

- [ ] Add failing tutorial-content assertions.
- [ ] Add direct “I want…” routes for each new behavior.
- [ ] Run targeted tests.
- [ ] Run `npm run verify`.
- [ ] Run `git diff --check` and confirm `.vite-8765.log` remains untracked and untouched.
