# Reader Reimport Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make importing a newer copy of the same work preserve reader data, and make a cache-cleared bookshelf entry reconnect to its original work and resume automatically.

**Architecture:** Continue using the exported work `id` as the only identity key; titles and authors are display data and never trigger a merge. Keep reader-owned state in `moirain_readerLibrary`, replace only `moirain_work_<id>`, and route both update and recovery through the existing import review before calling `loadWork`.

**Tech Stack:** Browser ES modules, localStorage, JSDOM integration tests, Node test runner, CSS.

## Global Constraints

- A merge requires an exact stable work ID match.
- Updating cached content must preserve slots, progress, placeholder values, identities, bookmarks, and completion state.
- Cache recovery launched from a missing bookshelf entry must reject a different work instead of importing it as a new book.
- Password-protected works and works with newly introduced placeholders must still show the landing form.
- The recovery path must not add a new permanent navigation entry or management section.

---

### Task 1: Distinguish update, recovery, and ordinary import

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-import-resilience.test.mjs`

**Interfaces:**
- Consumes: `savedReaderBook(workId)`, `cachedReaderWork(workId)`, `openReaderImportDialog(invoker, options)`.
- Produces: `readerImportMode(work)`, scoped recovery metadata on the import overlay, and exact-ID rejection for a mismatched recovery file.

- [ ] **Step 1: Write the failing recovery-scope test**

```js
test("cache recovery accepts only the exact bookshelf work id", async t => {
  // Seed a library book without moirain_work_<id>, open it from the shelf,
  // import a different valid work, and assert the dialog stays open with an
  // error that identifies the expected title.
})
```

- [ ] **Step 2: Run the focused test to verify the missing behavior**

Run: `node --test tests/reader-import-resilience.test.mjs`

Expected: FAIL because a mismatched file currently opens as a new work.

- [ ] **Step 3: Carry recovery intent through the existing dialog**

```js
function openReaderImportDialog(invoker, options) {
  var recoveryBook = options?.recoveryBook || null
  overlay.dataset.readerRecoveryWorkId = recoveryBook?.id || ""
  // Render one restrained sentence naming the expected work.
}

function importWork(work, root) {
  var expectedId = root?.dataset?.readerRecoveryWorkId || ""
  if (expectedId && result.work.id !== expectedId) {
    reportReaderImportError("这不是要恢复的作品文件，请重新选择。", root)
    return
  }
  // Continue into the existing review.
}
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/reader-import-resilience.test.mjs`

Expected: PASS.

---

### Task 2: Preserve reader state and resume after confirmation

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader-library-state.js`
- Test: `tests/reader-import-resilience.test.mjs`
- Test: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Consumes: `rememberReaderWork(library, work, now)`, `restoreArticleReadingState(work, progress)`, `loadWork(work, options)`.
- Produces: `canResumeReaderImport(work, book)` and review confirmation that calls `loadWork(work, { resume:true, skipLanding })`.

- [ ] **Step 1: Expand the state-preservation assertions**

```js
assert.equal(savedBook.slots.length, 2)
assert.equal(savedBook.slots[0].bookmarks[0].id, "bookmark-a")
assert.deepEqual(savedBook.slots[0].placeholderValues, { name:["云枝"] })
assert.equal(savedBook.slots[0].completedAt, 120)
```

- [ ] **Step 2: Add a failing direct-resume integration test**

```js
test("restoring a cleared cache resumes a valid saved article path", async t => {
  // Seed article progress ["start", "ending"] without a cached body.
  // Import the exact work, confirm recovery, and assert the landing screen is
  // skipped and the active article page is "ending".
})
```

- [ ] **Step 3: Implement the guarded resume decision**

```js
function canResumeReaderImport(work, book) {
  if (!book?.progress || String(work?.password || "").trim()) return false
  var savedValues = book.placeholderValues || {}
  return (work.placeholders || []).every(function(definition) {
    return Array.isArray(savedValues[definition.id])
      && typeof savedValues[definition.id][0] === "string"
  })
}
```

The review confirmation calls `loadWork(work, { resume:true, skipLanding:canResumeReaderImport(work, existingBook) })`. `rememberReaderWork` continues to replace only work metadata and placeholder definitions while retaining all slot-owned fields.

- [ ] **Step 4: Run the state and import tests**

Run: `node --test tests/reader-library-state.test.mjs tests/reader-import-resilience.test.mjs`

Expected: PASS.

---

### Task 3: Refine recovery copy and bookshelf state

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: `reviewReaderWorkImport(work, root)` and `.rd-book.is-missing`.
- Produces: separate update/recovery wording without a new permanent UI region.

- [ ] **Step 1: Add UI assertions**

```js
assert.match(missingBook.textContent, /正文已清理/)
assert.match(recoveryDialog.textContent, /重新导入/)
assert.match(recoveryReview.textContent, /接回原来的阅读记录/)
```

- [ ] **Step 2: Render concise state-specific copy**

```js
var recovering = !!existingBook && !existingCache
var label = recovering ? "恢复书架内容" : "检测到已有作品"
var action = recovering ? "恢复并继续" : "更新作品"
```

The bookshelf uses `正文已清理 · 重新导入` for missing content. The review lists preserved `存档、身份、占位符与书签` in one line.

- [ ] **Step 3: Reuse the current restrained component vocabulary**

Use the existing `.rd-import-review`, `.rd-import-review-summary`, `.rd-import-review-note`, and `.rd-book.is-missing` styles. Add only a compact recovery note style when the scoped import dialog needs it; include a visible `:focus-visible` state and no decorative motion.

- [ ] **Step 4: Run focused UI tests**

Run: `node --test tests/reader-library-tools-ui.test.mjs tests/reader-import-resilience.test.mjs`

Expected: PASS.

---

### Task 4: Verify the complete reader flow

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `reader/reader-library-state.js`
- Verify: `tests/reader-import-resilience.test.mjs`
- Verify: `tests/reader-library-state.test.mjs`
- Verify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Consumes: the completed update and recovery flow.
- Produces: fresh test, build, and browser evidence.

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/reader-import-resilience.test.mjs tests/reader-library-state.test.mjs tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run the full verification suite**

Run: `npm run verify`

Expected: all tests pass and the production verification build exits with code 0.

- [ ] **Step 3: Check patch hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Exercise the browser flow**

Open the reader shelf, clear one cached body, click its cover, verify the dialog names the expected work, import the same work, confirm `恢复并继续`, and verify the reader returns to the saved position. Separately import a newer copy of a still-cached work and verify the action says `更新作品`.
