# Reader Bookshelf Pinning Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with test-first changes and review each task before continuing.

**Goal:** Let readers pin one or more books through the existing book manager so pinned books stay ahead of unpinned books on every shelf sort.

**Architecture:** Store an optional positive `pinnedAt` timestamp on reader-owned book metadata. Normalize and preserve it through ordinary work refreshes, expose one immutable state transition, then make the shelf comparator treat pin state as the primary order and the selected shelf sort as the secondary order.

**Tech Stack:** Vanilla JavaScript, localStorage-backed reader library state, HTML/CSS, Node test runner, JSDOM.

## Global Constraints

- Do not add a new bookshelf-level button, context menu, modal, or dependency.
- Pinning is available only inside the existing “管理本书” dialog reached by long-press or the cover manage button.
- Multiple books may be pinned; pinned books sort by `pinnedAt` descending and always precede unpinned books.
- Pinned state survives work reopen, re-import, version update, storage round-trip, and every existing shelf sort.
- Show only a compact “置顶” text marker beside the book title; do not occupy another cover corner.
- Pin and unpin must be immediately persisted, keyboard accessible, and reflected in the shelf behind the open manager.
- Do not commit or push without an explicit user request.

---

### Task 1: Reader-owned pin state

**Files:**
- Modify: `reader/reader-library-state.js`
- Test: `tests/reader-library-state.test.mjs`

**Interfaces:**
- Produces: `setReaderBookPinned(library, workId, pinned, now = Date.now())`
- Persists: optional `book.pinnedAt: number`

- [ ] **Step 1: Write the failing state test**

Add assertions that pinning one book is immutable, a repeated pin is idempotent, round-trip normalization retains `pinnedAt`, `rememberReaderWork` and `reconcileReaderWorkUpdate` retain it, and unpinning removes the field.

- [ ] **Step 2: Run the state test and confirm it fails**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: FAIL because `setReaderBookPinned` is not exported.

- [ ] **Step 3: Implement normalized pin state**

In `normalizedBook`, retain only a positive normalized timestamp:

```js
const pinnedAt = timestamp(ownData(value, "pinnedAt"))
if (pinnedAt) book.pinnedAt = pinnedAt
```

In `rememberReaderWork`, preserve the prior value:

```js
if (previous?.pinnedAt) nextBook.pinnedAt = previous.pinnedAt
```

Add the immutable transition:

```js
export function setReaderBookPinned(library, workId, pinned, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!exactId(workId)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId) return book
    if (pinned === true) {
      if (book.pinnedAt) return book
      const pinnedAt = timestamp(now)
      return pinnedAt ? { ...book, pinnedAt } : book
    }
    if (!book.pinnedAt) return book
    const { pinnedAt, ...next } = book
    return next
  }))
}
```

- [ ] **Step 4: Run the state test and confirm it passes**

Run: `node --test tests/reader-library-state.test.mjs`

Expected: all tests pass.

### Task 2: Shelf ordering and manager interaction

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-bookshelf-ui.test.mjs`

**Interfaces:**
- Consumes: `setReaderBookPinned(...)`
- Renders: `.rd-book-title-row`, `.rd-book-pinned`, `[data-reader-book-pin]`

- [ ] **Step 1: Write the failing UI test**

Seed three cached books with two different `pinnedAt` values. Assert both pinned books precede the ordinary book, the newer pin precedes the older pin, the compact markers render, all shelf sort choices preserve pin priority, the manager control exposes `aria-pressed`, and clicking it removes then restores pin state in storage and shelf markup.

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `node --test tests/reader-bookshelf-ui.test.mjs`

Expected: FAIL because pin ordering, marker markup, and manager control do not exist.

- [ ] **Step 3: Implement pin-first sorting**

Use one stable primary comparator:

```js
function readerBookPinOrder(left, right) {
  const leftPinnedAt = Number(left?.pinnedAt) || 0
  const rightPinnedAt = Number(right?.pinnedAt) || 0
  if (leftPinnedAt && rightPinnedAt) return rightPinnedAt - leftPinnedAt
  if (leftPinnedAt) return -1
  if (rightPinnedAt) return 1
  return 0
}
```

Prefix every existing shelf sort comparator with `readerBookPinOrder(a, b) || ...`; for the default recent order, sort only with `readerBookPinOrder`.

- [ ] **Step 4: Implement compact shelf and manager UI**

Wrap the metadata title in `.rd-book-title-row`, append an aria-hidden `.rd-book-pinned` marker when `pinnedAt` exists, and include “已置顶” in the cover accessible label. Add a slim `.rd-book-pin-row` to the existing manager body with a secondary button labelled “置顶” or “取消置顶” and `aria-pressed`.

On click, persist `setReaderBookPinned(...)`, update the row copy/button state without reopening the dialog, refresh the shelf behind it, and announce “已置顶到书架顶部。” or “已取消置顶。” through the existing manager status.

- [ ] **Step 5: Style and verify responsive behavior**

Keep the marker beside the title, use existing surface/border/text tokens, keep the pin button at least 40px high, allow the row to wrap below 480px, and avoid new cover overlays.

- [ ] **Step 6: Run focused tests**

Run:

```text
node --test tests/reader-library-state.test.mjs tests/reader-bookshelf-ui.test.mjs tests/reader-data-package.test.mjs
```

Expected: all tests pass.

### Task 3: Visual and full verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`

- [ ] **Step 1: Inspect the real manager and shelf**

Run the local reader, seed pinned and ordinary books, then inspect the manager and shelf at the default viewport and at `390 × 844`. Confirm title truncation, tag spacing, button wrapping, keyboard naming, and multi-pin order.

- [ ] **Step 2: Run interface detection**

Run:

```text
node D:\Codex\home\skills\impeccable\scripts\detect.mjs --json reader\reader.js reader\reader.css
```

Expected: no new findings attributable to pinning.

- [ ] **Step 3: Run the full repository verification**

Run:

```text
npm run verify
git diff --check
```

Expected: all tests and production builds pass; no whitespace errors.

### Task 4: Stable focus after shelf reordering

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-bookshelf-ui.test.mjs`

**Interfaces:**
- Renders: `data-reader-book-cover-id` and `data-reader-book-manage-id`
- Produces: `focusReaderBookInvoker(workId, invoker)`

- [ ] **Step 1: Extend the pin interaction test**

After pinning changes the shelf order, close the existing manager and assert that focus lands on the newly rendered manage button for the same work rather than disappearing to the document body.

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `node --test tests/reader-bookshelf-ui.test.mjs`

Expected: FAIL because the original invoker is disconnected after the shelf refresh.

- [ ] **Step 3: Add stable book control identities and fallback focus**

Render exact work IDs on the cover and manage controls:

```js
data-reader-book-cover-id="..."
data-reader-book-manage-id="..."
```

When closing the manager, first focus the original invoker if it is still connected. Otherwise select the newly rendered control type that matches the original invoker, find the control whose dataset ID equals `workId`, and focus it.

- [ ] **Step 4: Run the UI test and confirm it passes**

Run: `node --test tests/reader-bookshelf-ui.test.mjs`

Expected: all tests pass.

### Task 5: Pin-first order inside work collections

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-bookshelf-ui.test.mjs`

**Interfaces:**
- Consumes: `readerBookPinOrder(left, right)`
- Preserves: collection author order for books with equal pin priority

- [ ] **Step 1: Write the failing collection directory test**

Seed a separate-access collection whose authored order is ordinary, older pin, newer pin. Open the directory and assert its work buttons render newer pin, older pin, ordinary.

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `node --test tests/reader-bookshelf-ui.test.mjs`

Expected: FAIL because the directory still iterates `collection.workIds` directly.

- [ ] **Step 3: Sort detached collection entries**

Build detached `{ workId, authoredIndex, work }` entries, map reader books once from `getReaderLibraryState()`, and sort with:

```js
readerBookPinOrder(
  libraryById.get(left.workId),
  libraryById.get(right.workId),
) || left.authoredIndex - right.authoredIndex
```

Render visible directory numbers from the sorted index; do not mutate `collection.workIds`.

- [ ] **Step 4: Run the UI test and confirm it passes**

Run: `node --test tests/reader-bookshelf-ui.test.mjs`

Expected: all tests pass.

### Task 6: Current-device pin preference during backup restore

**Files:**
- Modify: `reader/reader-data-package.js`
- Test: `tests/reader-data-package.test.mjs`

**Interfaces:**
- Changes: `mergeBook(currentBook, incomingBook)`
- Rule: an existing local book keeps the local presence or absence of `pinnedAt`; a book that exists only in the backup retains its backup pin

- [ ] **Step 1: Write the failing merge test**

Cover all three cases: local pinned plus newer unpinned backup stays pinned; local unpinned plus newer pinned backup stays unpinned; backup-only pinned book stays pinned.

- [ ] **Step 2: Run the package test and confirm it fails**

Run: `node --test tests/reader-data-package.test.mjs`

Expected: FAIL because `mergeBook` currently takes `pinnedAt` from whichever book has the newer `lastOpenedAt`.

- [ ] **Step 3: Preserve the current-device preference**

Create the merged book as today, then explicitly restore or remove `pinnedAt` based on `currentBook`:

```js
const merged = { ...preferred, addedAt, lastOpenedAt, slots, activeSlotId }
if (currentBook.pinnedAt) merged.pinnedAt = currentBook.pinnedAt
else delete merged.pinnedAt
return merged
```

Leave the early `if (!currentBook) return incomingBook` path unchanged so backup-only pins survive.

- [ ] **Step 4: Run focused and full verification**

Run:

```text
node --test tests/reader-bookshelf-ui.test.mjs tests/reader-data-package.test.mjs
npm run verify
git diff --check
```

Expected: all tests and production builds pass; no whitespace errors.
