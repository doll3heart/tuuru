# Reader Storage Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an imported work cannot be cached because browser storage is full, offer an inline, reader-controlled way to clear only older work bodies and continue the same import.

**Architecture:** A focused `reader-storage-rescue.js` module owns quota detection, cache candidate analysis, byte estimates, and rollback-safe clear-and-write behavior. `reader.js` performs one import cache attempt before leaving the import dialog; only quota failures reveal the rescue UI, while security failures keep the existing memory-only behavior. The library record remains untouched when caches are cleared, preserving progress, identities, placeholders, and bookmarks.

**Tech Stack:** Browser ES modules, localStorage, JSDOM, Node test runner, existing reader CSS tokens.

## Global Constraints

- Do not add a permanent navigation item or page.
- Never delete reader library records, progress, identities, placeholders, bookmarks, images, or appearance settings.
- Exclude the currently imported work from cleanup candidates.
- A failed retry must restore every cache selected for cleanup.
- Keep the import usable in memory when storage is unavailable for reasons other than quota.
- Use existing button, focus, status, and mobile-dialog conventions.

---

### Task 1: Cache Rescue Domain Logic

**Files:**
- Create: `reader/reader-storage-rescue.js`
- Create: `tests/reader-storage-rescue.test.mjs`

**Interfaces:**
- Produces: `isReaderStorageQuotaError(error) -> boolean`
- Produces: `readerStorageRescueCandidates(storage, library, options) -> { candidates, incomingBytes, suggestedBytes }`
- Produces: `installReaderCacheWithRescue(storage, input) -> { ok, clearedBytes, error }`

- [ ] **Step 1: Write failing tests**

Cover quota-name/code recognition, least-recently-read candidate ordering, exclusion of the incoming work, successful body-only cleanup, and exact rollback when the incoming cache still cannot be written.

- [ ] **Step 2: Run the domain tests and confirm they fail**

Run: `node --test tests/reader-storage-rescue.test.mjs`

Expected: FAIL because `reader-storage-rescue.js` does not exist.

- [ ] **Step 3: Implement the bounded storage helpers**

Read only `moirain_work_<id>` keys derived from normalized library books. Snapshot selected raw values before removal, reject unknown IDs, write the incoming cache, and restore every snapshot if removal or writing fails.

- [ ] **Step 4: Run the domain tests**

Run: `node --test tests/reader-storage-rescue.test.mjs`

Expected: all tests pass.

### Task 2: Inline Import Rescue Flow

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-storage-rescue-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 storage rescue helpers.
- Produces: `renderReaderStorageRescue(work, root, serialized, error)` and UI bindings scoped to the existing import dialog.

- [ ] **Step 1: Write failing UI tests**

Test that a quota failure keeps the import dialog open, lists only cached older works with size and last-read context, defaults enough rows selected, preserves library data, and continues the pending import after cleanup. Test that a failed retry reports the failure and restores the selected caches.

- [ ] **Step 2: Run the UI tests and confirm they fail**

Run: `node --test tests/reader-storage-rescue-ui.test.mjs`

Expected: FAIL because the rescue region is absent.

- [ ] **Step 3: Add the pre-cache import attempt and inline rescue**

Serialize the normalized imported work once. On success, call `loadWork` with `cachePrepared:true`. On quota failure, replace the import body with a compact region containing the estimate, checkbox rows, selected-total status, “仅本次阅读”, and “清理并继续”. On non-quota failure, preserve the existing memory-only path.

- [ ] **Step 4: Add responsive and accessible styles**

Use flat divided rows, existing colors, native checkboxes, 44px actions, visible focus, live status text, and a single-column mobile action layout. Do not add a nested card or decorative shadow.

- [ ] **Step 5: Run focused reader tests**

Run: `node --test tests/reader-storage-rescue.test.mjs tests/reader-storage-rescue-ui.test.mjs tests/reader-import-resilience.test.mjs`

Expected: all tests pass.

### Task 3: Product Verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `reader/reader-storage-rescue.js`

- [ ] **Step 1: Inspect the flow in the local reader**

Trigger a simulated quota failure, verify the dialog stays in context, keyboard focus reaches every action, selected totals update, cleanup continues import, and the layout has no horizontal overflow at desktop and mobile widths.

- [ ] **Step 2: Run syntax and diff checks**

Run: `node --check reader/reader.js`

Run: `node --check reader/reader-storage-rescue.js`

Run: `git diff --check`

Expected: all commands exit 0.

- [ ] **Step 3: Run complete tests and production build**

Run: `npm test`

Run: `npm run build:verify`

Expected: all tests pass and the production build exits 0.
