# Reader Multi-Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-run save slots, named reader identity groups, editable bookmark notes, spoiler-safe unlocked memories, and route comparison to the reader bookshelf.

**Architecture:** Keep the existing book-level progress fields as a compatibility mirror of the active slot, while each book owns up to five complete slot snapshots. Store reusable identity groups at library level and map their semantic placeholder keys into the active book slot. Derive memories and route differences from visited paths and selected choice IDs without exposing unvisited content.

**Tech Stack:** Vanilla ES modules, DOM APIs, localStorage, CSS, Node test runner, JSDOM.

## Global Constraints

- Existing version-1 reader libraries must load without reimporting works.
- A book always retains at least one slot and supports at most five slots.
- Identity group names and value inputs start empty; no example identity names are prefilled.
- Storage-center work and system text-to-speech are excluded from this implementation.
- Memories and route comparison must never reveal unvisited node or choice text.

---

### Task 1: Slot and identity state

**Files:**
- Modify: `reader/reader-library-state.js`
- Modify: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Produces: `createReaderSlot`, `switchReaderSlot`, `renameReaderSlot`, `removeReaderSlot`, `saveReaderIdentity`, `removeReaderIdentity`, `applyReaderIdentity`, and `updateReaderBookmark`.
- Preserves: existing `book.progress`, `book.completedAt`, `book.bookmarks`, and `book.placeholderValues` as the active-slot mirror.

- [ ] **Step 1: Add failing legacy and slot tests**

Test that a legacy book normalizes into one `reader-slot-default` slot, new slots are empty reading routes, switching updates the compatibility mirror, five slots is the hard limit, and the last slot cannot be removed.

- [ ] **Step 2: Add failing identity tests**

Test a blank name is rejected, caller-supplied names are retained, values map by placeholder `key`/`label`/`id`, applying a group updates only the active slot, and deleting a group retains already-applied text.

- [ ] **Step 3: Run focused state tests**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: FAIL because the slot and identity exports do not exist.

- [ ] **Step 4: Implement normalized state**

Add bounded slot and identity normalizers, active-slot mirroring, immutable CRUD operations, and route all existing placeholder/progress/completion/bookmark writes through the active slot.

- [ ] **Step 5: Re-run focused state tests**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: PASS.

### Task 2: Spoiler-safe journey insights

**Files:**
- Create: `reader/reader-journey-insights.js`
- Create: `tests/reader-journey-insights.test.mjs`

**Interfaces:**
- Produces: `readerUnlockedMemoir(work, slot)` and `compareReaderSlots(work, leftSlot, rightSlot)`.

- [ ] **Step 1: Write failing insight tests**

Use a branched article fixture to prove memoir output contains only node IDs present in `slot.progress.path`, and comparison contains only selected choice text from the two supplied `choiceMemory` records.

- [ ] **Step 2: Run focused insight tests**

Run: `node --test tests/reader-journey-insights.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement derivation helpers**

Build duplicate-safe node and choice indexes, emit visited chapter/location labels, and return divergence rows only when the two slots selected different known choices at a visited source.

- [ ] **Step 4: Re-run focused insight tests**

Run: `node --test tests/reader-journey-insights.test.mjs`

Expected: PASS.

### Task 3: Save-slot and identity manager UI

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 state operations.
- Produces: active slot selector, inline create/rename/remove controls, identity selector, and inline named-identity editor using the current book’s placeholder definitions.

- [ ] **Step 1: Add failing JSDOM assertions**

Assert the manager exposes the active slot, creates a second route without overwriting the first, accepts a user-entered identity group name, renders blank initial inputs, and applies the group to the active slot only.

- [ ] **Step 2: Implement progressive manager sections**

Place `阅读存档` before status, keep slot mutations inline, disable creation at five slots, require explicit confirmation before removing a slot, and keep identity creation collapsed until requested.

- [ ] **Step 3: Run focused UI tests**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 4: Bookmark notes, memories, and route comparison UI

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: `updateReaderBookmark`, `readerUnlockedMemoir`, and `compareReaderSlots`.
- Produces: editable bookmark label/note rows, an unlocked-memory section, and a two-slot route comparison panel.

- [ ] **Step 1: Add failing interaction assertions**

Assert bookmark edit fields preserve user text, memory rows exclude an unvisited branch, and route comparison shows only differing selected labels from two saved slots.

- [ ] **Step 2: Implement restrained inline panels**

Use native inputs/selects and existing manager typography, keep notes to 500 characters, show a teaching empty state, and show route comparison only when at least two slots exist.

- [ ] **Step 3: Run focused UI tests**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 5: Regression and browser verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `reader/reader-library-state.js`
- Verify: `reader/reader-journey-insights.js`

**Interfaces:**
- Produces: evidence that legacy imports, active reading, phone works, and narrow screens remain functional.

- [ ] **Step 1: Run full verification**

Run: `npm run verify`

Expected: all Node tests and production build verification pass.

- [ ] **Step 2: Run whitespace validation**

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Perform browser QA**

Verify one legacy book becomes `存档 1`, a second slot can be created and switched, identity inputs begin empty, bookmark notes persist, memories remain spoiler-safe, route comparison is readable, and the manager scrolls correctly on desktop and narrow screens.
