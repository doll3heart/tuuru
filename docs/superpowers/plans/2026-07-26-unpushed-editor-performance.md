# Unpushed Editor Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce author-editor slowdown as nodes, choices, conditions, notes, and interactive-scene pictures accumulate without changing UI, behavior, storage schema, or exports.

**Architecture:** Keep all existing public data models and rendered markup. Add a small buffered persistence boundary for high-frequency text input, precompute immutable lookup maps once per outline render, and update the existing interactive-scene preview controller in place instead of destroying its complete DOM tree.

**Tech Stack:** Browser JavaScript modules, localStorage, JSDOM, Node test runner, Vite.

## Global Constraints

- Do not change UI markup, copy, layout, or styling.
- Do not change work schema, author-note schema, reader behavior, preview behavior, or export contents.
- Flush buffered edits before navigation, structural mutations, page hiding, and editor refresh.
- Preserve immediate character counts and in-memory draft updates.
- Do not stage, commit, or push the existing dirty worktree.

---

### Task 1: Buffered high-frequency persistence

**Files:**
- Create: `js/editor-persistence-buffer.js`
- Modify: `js/pages/editor.js`
- Test: `tests/editor-persistence-buffer.test.mjs`

**Interfaces:**
- Produces: `createEditorPersistenceBuffer({ delay, setTimer, clearTimer })`
- Buffer methods: `schedule(key, write)`, `flush(key?)`, `cancel(key?)`, `pendingCount`

- [ ] **Step 1: Write regression tests**

```js
const writes = []
const buffer = createEditorPersistenceBuffer({ delay: 180, setTimer, clearTimer })
buffer.schedule("node:1", () => writes.push("old"))
buffer.schedule("node:1", () => writes.push("new"))
assert.equal(writes.length, 0)
buffer.flush("node:1")
assert.deepEqual(writes, ["new"])
```

Cover independent node/note keys, timer coalescing, explicit flush-all, and cancellation.

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `node --test tests/editor-persistence-buffer.test.mjs`

Expected: FAIL because `editor-persistence-buffer.js` does not exist.

- [ ] **Step 3: Implement the keyed trailing buffer**

```js
export function createEditorPersistenceBuffer(options = {}) {
  const pending = new Map()
  function schedule(key, write) {
    cancelTimerOnly(key)
    const entry = { write, timer: setTimer(() => flush(key), delay) }
    pending.set(key, entry)
  }
  function flush(key) {
    // Remove before invoking so re-entrant schedules remain pending.
  }
  return { schedule, flush, cancel, get pendingCount() { return pending.size } }
}
```

- [ ] **Step 4: Integrate without changing visible behavior**

Use separate keys for正文 and author notes. Continue updating counters immediately. Flush before `refreshEditor`, delegated clicks/changes that can navigate or mutate structure, `pagehide`, and `visibilitychange` when hidden.

- [ ] **Step 5: Verify focused tests**

Run: `node --test tests/editor-persistence-buffer.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-author-notes.test.mjs`

Expected: all pass.

---

### Task 2: Linear-time outline render index

**Files:**
- Create: `js/article-editor-render-index.js`
- Modify: `js/pages/editor.js`
- Test: `tests/article-editor-render-index.test.mjs`

**Interfaces:**
- Produces: `createArticleEditorRenderIndex(work)`
- Index fields: `chapters`, `nodesByChapterId`, `siblingPositionByNodeId`, `targetPathByNodeId`, `conditionLabelByChoiceId`

- [ ] **Step 1: Write semantic and scale regression tests**

```js
const index = createArticleEditorRenderIndex(work)
assert.deepEqual(index.nodesByChapterId.get("chapter-1"), [nodeA, nodeB])
assert.deepEqual(index.siblingPositionByNodeId.get("node-b"), { index: 1, count: 2 })
assert.equal(index.targetPathByNodeId.get("node-b"), "第一章 → 节点 B")
assert.equal(index.conditionLabelByChoiceId.get("choice-a"), "同意")
```

Include missing chapters, duplicate IDs, interaction choices, and hundreds of nodes to prove one precomputed catalog is reused.

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `node --test tests/article-editor-render-index.test.mjs`

Expected: FAIL because the render-index module does not exist.

- [ ] **Step 3: Build lookup maps in one pass**

```js
export function createArticleEditorRenderIndex(work) {
  const nodesByChapterId = new Map()
  const siblingPositionByNodeId = new Map()
  // Populate chapter/node/choice lookup maps once while retaining authored order.
  return { chapters, nodesByChapterId, siblingPositionByNodeId, targetPathByNodeId, conditionLabelByChoiceId }
}
```

- [ ] **Step 4: Consume the index in `buildWorldTree` and `nodeHTML`**

Replace per-node `filter`, `findIndex`, `describeArticleTarget`, and `buildArticleChoiceCatalog` calls with lookup access. Keep the generated markup and disabled/invalid condition wording unchanged.

- [ ] **Step 5: Verify outline and hidden-node tests**

Run: `node --test tests/article-editor-render-index.test.mjs tests/article-outline-accessibility.test.mjs tests/article-hidden-node-editor.test.mjs tests/article-node-drag-integration.test.mjs`

Expected: all pass.

---

### Task 3: Reusable interactive-scene preview

**Files:**
- Modify: `js/interactive-scene-renderer.js`
- Modify: `js/interactive-scene-editor.js`
- Test: `tests/interactive-scene-renderer.test.mjs`
- Test: `tests/interactive-scene-editor.test.mjs`

**Interfaces:**
- Extend controller with `updateScene(sceneValue, stageId, { normalized = false } = {})`
- Preserve the existing controller methods and return values.

- [ ] **Step 1: Write identity-preservation regression tests**

```js
const controller = mountInteractiveScene(container, firstScene)
const root = container.firstElementChild
controller.updateScene(secondScene, "stage-2")
assert.equal(container.firstElementChild, root)
assert.equal(controller.stage.id, "stage-2")
assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, "updated")
```

In the editor test, dispatch several text/range inputs and assert the preview root and controller are reused while saved scene data remains identical.

- [ ] **Step 2: Run the tests and confirm the new assertions fail**

Run: `node --test tests/interactive-scene-renderer.test.mjs tests/interactive-scene-editor.test.mjs`

Expected: FAIL because the controller has no `updateScene`.

- [ ] **Step 3: Update the renderer in place**

Change the renderer's normalized `scene` binding to `let`. `updateScene` replaces the normalized scene, resolves the requested stage, clears transient reaction state through the existing `renderStage`, and keeps the root, media nodes, observers, and controller instance.

- [ ] **Step 4: Avoid duplicate draft normalization**

Keep the editor draft structurally shared and constrained by the existing controls. Normalize at initial load and save; pass the already-normalized draft to the preview controller's trusted update path. Retain a fallback mount only for the initial preview.

- [ ] **Step 5: Verify all interactive-scene tests**

Run: `node --test tests/interactive-scene-*.test.mjs tests/reader-interactive-scene-*.test.mjs`

Expected: all pass.

---

### Task 4: Full compatibility and performance verification

**Files:**
- Modify only tests if an uncovered non-UI regression is found.

- [ ] **Step 1: Run focused author-editor tests**

Run: `node --test tests/editor-persistence-buffer.test.mjs tests/article-editor-render-index.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-target-picker-integration.test.mjs tests/article-hidden-node-editor.test.mjs tests/interactive-scene-editor.test.mjs tests/interactive-scene-renderer.test.mjs`

Expected: all pass.

- [ ] **Step 2: Run full verification**

Run: `npm run verify`

Expected: unit tests, TypeScript checks, and production build all exit successfully.

- [ ] **Step 3: Check the patch**

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.

- [ ] **Step 4: Review the final diff against constraints**

Confirm there are no CSS changes, no altered UI strings/markup, no schema changes, and no reader/export behavior changes.
