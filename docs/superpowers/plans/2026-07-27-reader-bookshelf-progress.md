# Reader Bookshelf and Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn imported reader works into a persistent bookshelf with remembered placeholders, automatic continuation, and reversible article choice checkpoints.

**Architecture:** Keep imported work bytes in the existing `moirain_work_<id>` records and store only small reader-owned metadata in a versioned `moirain_readerLibrary` record. A pure library-state module validates all persisted values, while `reader.js` remains responsible for applying valid state to the current work and rendering the existing reader surfaces.

**Tech Stack:** Vanilla ES modules, localStorage, sessionStorage, DOM/CSS, Node test runner, JSDOM, Vite.

## Global Constraints

- Reader state remains local to the browser and is never written into exported work files.
- Passwords are never persisted.
- Existing work IDs and stable node/choice IDs are the only resume keys.
- Long-press must have an explicit keyboard/pointer-accessible management-button equivalent.
- Invalid or stale saved routes fail closed to the work's normal start node.
- No new dependency, API, account, upload, or AI processing.

---

### Task 1: Versioned reader-library state

**Files:**
- Create: `reader/reader-library-state.js`
- Test: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Produces: `readReaderLibrary(storage)`, `rememberReaderWork(library, work, now)`, `saveReaderPlaceholders(library, workId, values, now)`, `saveReaderProgress(library, workId, progress, now)`, `clearReaderProgress(library, workId, now)`, `readerBook(library, workId)`, and `restoreArticleReadingState(work, progress)`.

- [ ] **Step 1: Write failing normalization and immutable-update tests**

```js
const remembered = rememberReaderWork(emptyReaderLibrary(), work, 100)
assert.equal(remembered.books[0].title, work.title)
assert.deepEqual(saveReaderPlaceholders(remembered, work.id, { name: ["云"] }, 110)
  .books[0].placeholderValues, { name: ["云"] })
```

- [ ] **Step 2: Run the model test and confirm the missing-module failure**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: FAIL because `reader/reader-library-state.js` does not exist.

- [ ] **Step 3: Implement strict versioned normalization and bounded records**

```js
export const READER_LIBRARY_VERSION = 1
export const READER_LIBRARY_STORAGE_KEY = "moirain_readerLibrary"

export function emptyReaderLibrary() {
  return { version:READER_LIBRARY_VERSION, books:[] }
}
```

All update functions clone input, cap checkpoints at eight, cap books at one hundred, retain only own data properties, and serialize only strings, arrays, numbers, booleans, and null.

- [ ] **Step 4: Run model tests**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: PASS.

### Task 2: Automatic progress and placeholder persistence

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-progress-persistence.test.mjs`

**Interfaces:**
- Consumes: Task 1 library helpers.
- Produces: automatic article route restore, phone-flow index restore, per-work placeholder prefill, and progress reset.

- [ ] **Step 1: Write failing reader integration tests**

```js
document.querySelector("[data-reader-book-index='0']").click()
document.querySelector("#rdStartBtn").click()
document.querySelector(".article-choice-btn").click()
document.querySelector("[data-reader-home]").click()
document.querySelector("[data-reader-book-index='0']").click()
assert.match(document.querySelector(".article-reader").textContent, /Ending/)
```

Add a second case proving stored placeholder values prefill the landing form and are reused without changing the authored work.

- [ ] **Step 2: Run the integration test and confirm it fails**

Run: `node --test tests/reader-progress-persistence.test.mjs`

Expected: FAIL because no reader-library progress is restored.

- [ ] **Step 3: Wire persistence into reader lifecycle**

Add `getReaderLibrary`, `commitReaderLibrary`, `rememberCurrentReaderWork`, `saveCurrentReaderProgress`, and `applySavedReaderState`. Call them after imported work admission, placeholder confirmation, article route render, phone-flow advance, and explicit reset.

- [ ] **Step 4: Run progress integration tests**

Run: `node --test tests/reader-progress-persistence.test.mjs`

Expected: PASS.

### Task 3: Choice checkpoints and rollback

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader-library-state.js`
- Modify: `tests/reader-library-state.test.mjs`
- Modify: `tests/reader-progress-persistence.test.mjs`

**Interfaces:**
- Consumes: article path, branch memory, and interaction-selection state.
- Produces: the latest eight pre-choice snapshots and `restoreReaderCheckpoint(workId, checkpointId)`.

- [ ] **Step 1: Add failing checkpoint tests**

```js
const next = appendReaderCheckpoint(progress, {
  id:"cp-1", label:"留下", path:["start"], choiceMemory:{}, interactionSelections:{},
}, 200)
assert.equal(next.checkpoints.at(-1).label, "留下")
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-progress-persistence.test.mjs`

Expected: FAIL because checkpoint APIs and UI do not exist.

- [ ] **Step 3: Capture state before branch and interaction choices**

Capture a checkpoint immediately before applying a new choice. Deduplicate equal source/path snapshots and bound the list to eight.

- [ ] **Step 4: Restore checkpoints from the management panel**

Validate the stored checkpoint against the latest work, replace route memory, persist the restored progress, and reopen the reader at that point.

- [ ] **Step 5: Run checkpoint tests**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-progress-persistence.test.mjs`

Expected: PASS.

### Task 4: Bookshelf surface and long-press management

**Files:**
- Create: `reader/book-cover-hold.js`
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-home-navigation.test.mjs`
- Create: `tests/reader-bookshelf-ui.test.mjs`
- Create: `tests/book-cover-hold.test.mjs`

**Interfaces:**
- Produces: a fourth accessible home tab (`书架`), cover-based book buttons, a visible management-button equivalent, and a long-press gesture that opens the same dialog.

- [ ] **Step 1: Write failing bookshelf and hold-gesture tests**

```js
assert.equal(document.querySelector('[data-tab="library"]').textContent, "书架")
assert.ok(document.querySelector(".rd-bookshelf-cover"))
assert.equal(document.querySelector("[data-reader-book-manage]").getAttribute("aria-label"), "管理《作品》")
```

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `node --test tests/reader-home-navigation.test.mjs tests/reader-bookshelf-ui.test.mjs tests/book-cover-hold.test.mjs`

Expected: FAIL because the shelf does not exist.

- [ ] **Step 3: Render the bookshelf**

Move recent works and imported collections out of the personal panel. Render works as a responsive cover shelf with title, author/type, last-read time, continuation label, missing-cache state, and a short “长按封面可管理” hint.

- [ ] **Step 4: Add long-press and accessible management**

Use Pointer Events with a 520 ms threshold and 10 px movement cancellation. The explicit manage button and `contextmenu` open the same dialog; keyboard activation never depends on long-press.

- [ ] **Step 5: Build the book-management dialog**

Render all work placeholders with saved values, forbidden-word validation, progress summary, continue, restart, and latest checkpoint actions. Do not display or store the work password.

- [ ] **Step 6: Add responsive and reduced-motion CSS**

Use a cover shelf that fits 140–190 px columns, preserves 44 px touch targets, shows focus states, and disables nonessential transitions under `prefers-reduced-motion`.

- [ ] **Step 7: Run bookshelf tests**

Run: `node --test tests/reader-home-navigation.test.mjs tests/reader-bookshelf-ui.test.mjs tests/book-cover-hold.test.mjs`

Expected: PASS.

### Task 5: Browser and full regression verification

**Files:**
- Modify only if browser inspection exposes defects.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified mobile and desktop bookshelf, continuation, placeholder edit, and rollback behavior.

- [ ] **Step 1: Run focused reader tests**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-progress-persistence.test.mjs tests/reader-home-navigation.test.mjs tests/reader-bookshelf-ui.test.mjs tests/book-cover-hold.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 2: Inspect in browser at mobile and desktop widths**

Verify empty shelf, populated shelf, long-press, manage-button keyboard path, saved placeholder prefill, continue reading, restart, checkpoint rollback, missing cached work, and storage-error copy.

- [ ] **Step 3: Run whitespace and full project verification**

Run: `git diff --check`

Expected: no output and exit code 0.

Run: `npm run verify`

Expected: all Node tests pass and the production Vite build exits 0.
