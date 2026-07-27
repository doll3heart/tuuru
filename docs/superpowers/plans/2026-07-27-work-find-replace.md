# Work Find and Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preview-first, whole-work literal find-and-replace tool for article and phone works.

**Architecture:** A pure `work-text-replace` model indexes only allowlisted reader-visible text fields and replaces rich-text node content outside HTML tags and entities. The home page opens a shared modal from each work card, then persists selected field replacements through the existing guarded local-database mutation path.

**Tech Stack:** Browser ES modules, IndexedDB/local-storage compatibility layer, Node test runner, Vite.

## Global Constraints

- Replace visible authored text only; never replace IDs, URLs, image data, branch targets, choice references, or structural enum fields.
- Treat the search text literally, with case-insensitive matching by default and an explicit case-sensitive option.
- Preview every matching field and occurrence count before enabling the write.
- Replacement may be empty; search text may not be empty.
- The write must be atomic, guarded by the previewed work token, and blocked while the work is open in another editor.
- Preserve all unknown work fields and leave the source work object unchanged.

---

### Task 1: Pure text indexing and replacement model

**Files:**
- Create: `js/work-text-replace.js`
- Create: `tests/work-text-replace.test.mjs`

**Interfaces:**
- Produces: `findWorkTextMatches(work, { search, caseSensitive })`
- Produces: `replaceWorkText(work, { search, replacement, caseSensitive, selectedMatchIds })`
- Each match contains `{ id, path, category, field, preview, occurrences }`.

- [ ] **Step 1: Write failing model tests**

Cover article titles, chapter/node/choice text, rich HTML text without attribute mutation, phone contacts/messages/moments/forum/memos, literal metacharacters, case sensitivity, selected fields, empty replacement, source immutability, and URL/ID exclusion.

- [ ] **Step 2: Run the model test and confirm it fails**

Run: `node --test tests/work-text-replace.test.mjs`

Expected: failure because `js/work-text-replace.js` does not exist.

- [ ] **Step 3: Implement the allowlisted traversal**

Use an iterative own-property walk, an allowlist of visible scalar keys and visible string-array keys, category labels derived from the nearest known collection, JSON-encoded paths as stable match IDs, and a conservative HTML tokenizer for `nodes[*].content`.

- [ ] **Step 4: Implement immutable selected-field replacement**

Clone the work only after matches are selected, set only exact indexed paths, return `{ work, matchedFields, replacementCount, changed }`, and return the original work when no replacement occurs.

- [ ] **Step 5: Run the model test**

Run: `node --test tests/work-text-replace.test.mjs`

Expected: all model tests pass.

### Task 2: Guarded home mutation

**Files:**
- Modify: `js/home-work-mutations.js`
- Modify: `tests/home-work-mutations.test.mjs`

**Interfaces:**
- Consumes: `replaceWorkText`
- Produces: `replaceHomeWorkText(args, dependencies)`
- `args` contains `workId`, `expectedWorkToken`, `search`, `replacement`, `caseSensitive`, and `selectedMatchIds`.

- [ ] **Step 1: Write failing guarded-mutation tests**

Verify exact selected replacement, updated timestamp, stale-token rejection, active-editor rejection, no write for invalid or empty replacement results, and preservation of unrelated fields.

- [ ] **Step 2: Run the focused mutation tests and confirm failure**

Run: `node --test tests/home-work-mutations.test.mjs`

Expected: failure because `replaceHomeWorkText` is not exported.

- [ ] **Step 3: Implement the mutation**

Validate scalar inputs and match IDs before opening the edit session. Inside `commitLocalDatabaseMutation`, resolve the unique latest work, run `replaceWorkText`, reject an unchanged result, update `updatedAt`, and return a verified outcome with replacement metadata.

- [ ] **Step 4: Run the focused mutation tests**

Run: `node --test tests/home-work-mutations.test.mjs`

Expected: all home mutation tests pass.

### Task 3: Preview-first home modal

**Files:**
- Create: `js/pages/home-find-replace.js`
- Modify: `js/pages/home.js`
- Modify: `css/styles.css`
- Create: `tests/home-find-replace-ui.test.mjs`

**Interfaces:**
- Consumes: `findWorkTextMatches`, `createJsonToken`, `replaceHomeWorkText`, and the existing home write controller.
- Produces: `openWorkFindReplace(workId, { save })`.

- [ ] **Step 1: Write failing UI contract tests**

Require the work-card menu entry, accessible dialog labels, search/replacement controls, case-sensitive option, per-field checkboxes, match counts, disabled confirmation before preview, guarded save call, and responsive styles.

- [ ] **Step 2: Run the UI test and confirm failure**

Run: `node --test tests/home-find-replace-ui.test.mjs`

Expected: failure because the module and menu entry do not exist.

- [ ] **Step 3: Implement the modal**

Render escaped values only, debounce preview updates, default all fields to selected, preserve selections while the same search result remains, show category/location/preview/occurrence count, and require an explicit confirmation click.

- [ ] **Step 4: Connect reliable and legacy writes**

Add a `replaceText` action to `createHomeWriteController`, map its pending/error state to the modal controls, use `replaceHomeWorkText` when reliable writes are enabled, and use the same pure model plus `updateWork` only in compatibility mode.

- [ ] **Step 5: Add compact responsive styling**

Use existing modal, form, button, status, and warning tokens. Stack controls and keep 44px touch targets on narrow screens.

- [ ] **Step 6: Run focused UI and mutation tests**

Run: `node --test tests/home-find-replace-ui.test.mjs tests/work-text-replace.test.mjs tests/home-work-mutations.test.mjs`

Expected: all focused tests pass.

### Task 4: Browser and repository verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Exercise both work types in the local browser**

Preview matches, deselect one field, replace the remaining fields, confirm the edited work opens correctly, and remove any temporary test work.

- [ ] **Step 2: Check the diff**

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Run complete verification**

Run: `npm run verify`

Expected: all tests and production builds pass.
