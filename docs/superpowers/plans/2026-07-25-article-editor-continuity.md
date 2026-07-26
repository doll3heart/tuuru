# Article Editor Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ordinary interactions visibly testable and preserve each article's local editing position, chapter disclosures, and choice-list disclosures.

**Architecture:** Store author-only view state in a dedicated, versioned local-storage record keyed by work ID; never add it to the work schema or exported work. Keep state parsing and mutation in a small pure module, then let the existing editor renderer consume that state and persist explicit user actions.

**Tech Stack:** Browser ES modules, localStorage, JSDOM, Node test runner, CSS.

## Global Constraints

- View state is local to the author device and must not enter work data or reader exports.
- Existing work data, choice IDs, node IDs, and chapter IDs remain unchanged.
- Existing dirty interactive-scene work in `js/pages/editor.js` and `css/styles.css` must be preserved.
- Ordinary interactions never navigate to another node.

---

### Task 1: Local article-editor view-state module

**Files:**
- Create: `js/article-editor-view-state.js`
- Create: `tests/article-editor-view-state.test.mjs`

**Interfaces:**
- Produces: `readArticleEditorViewState(workId, storage)` returning `{nodeId, collapsedChapterIds, collapsedChoiceNodeIds}`.
- Produces: `writeArticleEditorViewState(workId, patch, storage)` returning the normalized stored state.

- [ ] **Step 1: Write failing normalization and isolation tests**

```js
test("view state is isolated by work and rejects malformed stored values", () => {
  const storage = memoryStorage()
  writeArticleEditorViewState("work-a", {
    nodeId:"node-a",
    collapsedChapterIds:["chapter-a", "chapter-a", 7],
    collapsedChoiceNodeIds:["node-a"],
  }, storage)
  assert.deepEqual(readArticleEditorViewState("work-a", storage), {
    nodeId:"node-a",
    collapsedChapterIds:["chapter-a"],
    collapsedChoiceNodeIds:["node-a"],
  })
  assert.deepEqual(readArticleEditorViewState("work-b", storage), emptyState)
})
```

- [ ] **Step 2: Run the focused test and confirm the missing module fails**

Run: `node --test tests/article-editor-view-state.test.mjs`

Expected: FAIL because `js/article-editor-view-state.js` does not exist.

- [ ] **Step 3: Implement bounded, versioned local state**

```js
const STORAGE_KEY = "tuuru_article_editor_view"

export function readArticleEditorViewState(workId, storage = globalThis.localStorage) {
  const all = readAll(storage)
  return normalizeState(all.works[String(workId || "")])
}

export function writeArticleEditorViewState(workId, patch, storage = globalThis.localStorage) {
  const all = readAll(storage)
  const key = String(workId || "")
  const next = normalizeState({...all.works[key], ...patch})
  all.works[key] = next
  try { storage.setItem(STORAGE_KEY, JSON.stringify(all)) } catch {}
  return next
}
```

- [ ] **Step 4: Run the focused state tests**

Run: `node --test tests/article-editor-view-state.test.mjs`

Expected: PASS.

### Task 2: Restore node and disclosure state

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `tests/article-outline-accessibility.test.mjs`

**Interfaces:**
- Consumes: `readArticleEditorViewState` and `writeArticleEditorViewState` from Task 1.
- Produces: restored last node, chapter disclosure state, and per-node jump-list disclosure state.

- [ ] **Step 1: Add integration assertions**

```js
test("last node and outline disclosures survive a render without changing work data", () => {
  let root = render()
  root.querySelector('[data-n="node-b"]').click()
  root = document.getElementById("app")
  root.querySelector(".wt-chapter-toggle").click()
  root.innerHTML = renderEditor(work.id)
  assert.ok(root.querySelector("#ce_node-b"))
  assert.equal(root.querySelector(".wt-chapter-toggle").getAttribute("aria-expanded"), "false")
})
```

- [ ] **Step 2: Run the integration test and confirm it fails**

Run: `node --test tests/article-outline-accessibility.test.mjs`

Expected: FAIL because current renders always expand chapters and do not restore a node after a fresh work entry.

- [ ] **Step 3: Restore and persist editor-only state**

Import the Task 1 helpers. On work entry, use the saved node only when it still exists; otherwise fall back to the first node. Render chapter `aria-expanded`, `hidden`, and arrow state from `collapsedChapterIds`. Wrap branch destinations beneath each source node in an accessible disclosure controlled by `collapsedChoiceNodeIds`; ordinary interaction choices are not rendered as destinations because they have no target.

- [ ] **Step 4: Run editor outline and mobile-shell tests**

Run: `node --test tests/article-editor-view-state.test.mjs tests/article-outline-accessibility.test.mjs tests/article-editor-mobile-shell.test.mjs`

Expected: PASS.

### Task 3: Explicit ordinary-interaction feedback

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Modify: `tests/article-editor-mobile-shell.test.mjs`

**Interfaces:**
- Consumes: existing `choice.mode === "interaction"` behavior.
- Produces: one visibly selected ordinary interaction per node in both author preview and reader.

- [ ] **Step 1: Add an author-preview interaction test**

```js
test("ordinary interaction preview selects one response without navigation or a work write", () => {
  const before = localStorage.getItem("tuuru_works")
  const option = document.querySelector('[data-choice-mode="interaction"]')
  option.click()
  assert.equal(option.getAttribute("aria-pressed"), "true")
  assert.match(option.textContent, /已选择/)
  assert.equal(localStorage.getItem("tuuru_works"), before)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/article-editor-mobile-shell.test.mjs`

Expected: FAIL because the author handler currently returns without feedback.

- [ ] **Step 3: Add selected-state behavior and styling**

For an author-preview ordinary interaction, clear the selected state only among sibling interaction buttons, then apply `.is-selected`, `aria-pressed="true"`, and a visible `已选择` marker to the clicked button. Strengthen the existing reader `.is-selected` rule with the same visible marker while retaining `aria-pressed`.

- [ ] **Step 4: Run all focused tests**

Run: `node --test tests/article-choice-model.test.mjs tests/article-editor-view-state.test.mjs tests/article-outline-accessibility.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-chapter-runtime.test.mjs`

Expected: PASS.

- [ ] **Step 5: Verify the production build**

Run: `npm run build:verify`

Expected: TypeScript build and build verification PASS.
