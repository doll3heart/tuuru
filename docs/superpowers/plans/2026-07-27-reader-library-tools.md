# Reader Library Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bookshelf cleanup, scene bookmarks, reading footprints, search/sort, and explicit reading status without breaking previously stored reader libraries.

**Architecture:** Extend the existing detached reader-library record with normalized optional bookmarks and completion state while keeping storage version 1 backward compatible. Keep work bodies in their existing cache keys, derive shelf presentation from pure helpers, and place secondary actions inside the existing book manager. Reuse article choice checkpoints as the reading-footprint source.

**Tech Stack:** Vanilla ES modules, DOM APIs, localStorage, CSS, Node test runner, JSDOM.

## Global Constraints

- Existing version 1 reader-library JSON must continue to load.
- Reader-library metadata must not contain passwords or full work bodies.
- All shelf covers remain neutral white/black and follow the existing theme tokens.
- Search controls appear only when the shelf contains more than six books.
- Destructive removal requires an explicit second confirmation.

---

### Task 1: Reader-library state

**Files:**
- Modify: `reader/reader-library-state.js`
- Modify: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Produces: `readerBookStatus(book)`, `setReaderCompletion(library, workId, completed, now)`, `toggleReaderBookmark(library, workId, bookmark, now)`, `removeReaderBookmark(library, workId, bookmarkId)`, and `removeReaderBook(library, workId)`.

- [ ] **Step 1: Write failing state tests**

Add tests proving old version-1 books normalize with `completedAt:0` and `bookmarks:[]`, completion survives metadata refresh, article bookmarks deduplicate by full route state, bookmarks are bounded, and removal affects only the requested work.

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: FAIL because the new exports and normalized fields do not exist.

- [ ] **Step 3: Implement normalized state operations**

Normalize completion timestamps and article bookmark snapshots, preserve them in `rememberReaderWork`, clear completion when progress is restarted, and implement immutable toggle/remove helpers.

- [ ] **Step 4: Re-run focused tests**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: PASS.

### Task 2: Bookshelf discovery and status

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: `readerBookStatus(book)`.
- Produces: shelf search by title/author, sort modes `recent`, `title`, `added`, and `status`, plus visible status labels.

- [ ] **Step 1: Write UI source and DOM assertions**

Assert the controls appear only above six books, filtering matches both title and author, sort selection is preserved during the session, and each cover exposes one of `未开始`, `阅读中`, or `已完成`.

- [ ] **Step 2: Run the focused UI test**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: FAIL because shelf tools are absent.

- [ ] **Step 3: Implement shelf controls**

Add session-only query/sort state, stable sorted book IDs, DOM filtering without rerendering per keystroke, an empty-search state, and restrained responsive controls.

- [ ] **Step 4: Re-run the focused UI test**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 3: Manager cleanup and reading state

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: `setReaderCompletion(...)` and `removeReaderBook(...)`.
- Produces: cache-size display, clear-body-cache action, two-step full removal, and manual completed/reading toggle.

- [ ] **Step 1: Add failing manager assertions**

Assert the manager displays status and local-space sections, cache clearing retains the library record, and confirmed removal deletes the library record, work cache, and matching recent item.

- [ ] **Step 2: Run the focused UI test**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: FAIL because manager actions are absent.

- [ ] **Step 3: Implement manager actions**

Compute UTF-8 cache size, update status immutably, clear only `moirain_work_<id>` for cache cleanup, and show an inline confirmation before complete removal.

- [ ] **Step 4: Re-run the focused UI test**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 4: Article scene bookmarks and reading footprint

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: `toggleReaderBookmark(...)` and `removeReaderBookmark(...)`.
- Produces: an article-reader bookmark toggle, manager bookmark jump/delete actions, and an expanded reading-footprint section backed by existing checkpoints.

- [ ] **Step 1: Add failing bookmark and footprint assertions**

Assert the article reader exposes an `aria-pressed` bookmark control, toggling stores a complete route snapshot, bookmark jump restores that route, delete removes only the selected bookmark, and the manager labels checkpoint history as `阅读足迹`.

- [ ] **Step 2: Run the focused UI test**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: FAIL because bookmark controls are absent.

- [ ] **Step 3: Implement bookmark and footprint interactions**

Build a bookmark from the current article path, choice memory, interaction selections, and checkpoint list; use chapter/node titles for labels; restore via existing progress validation; and keep all secondary actions in the manager.

- [ ] **Step 4: Re-run the focused UI test**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 5: Completion and regression verification

**Files:**
- Modify: `reader/reader.js`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: the completed-state API and article terminal-state calculation.
- Produces: automatic article completion at a true terminal route and completion reset on restart.

- [ ] **Step 1: Add terminal-state assertions**

Assert terminal article routes mark the book completed, branch/next-chapter routes remain reading, and restart clears completion.

- [ ] **Step 2: Implement terminal completion**

After rendering and persisting an article route, mark completion only when there is no branch choice, interaction continuation, pending interactive scene, or next chapter.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm run verify`

Expected: all Node tests and production build verification pass.

- [ ] **Step 4: Perform browser QA**

At desktop and narrow mobile widths, verify search, sorting, status chips, bookmark toggle, manager scrolling, cache clearing copy, confirmation flow, keyboard focus, and light/dark theme contrast.
