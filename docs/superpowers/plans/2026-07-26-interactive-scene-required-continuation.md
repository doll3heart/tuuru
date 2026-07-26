# Interactive Scene Required Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every interactive-picture scene a required, stable-ID continuation target that the reader opens after the final picture.

**Architecture:** Store the fixed exit on the scene as `nextNodeId`. The scene editor receives chapter-grouped eligible targets from the article editor and blocks saving until one valid target is selected. The reader uses the same explicit-target transition used by article branches, while legacy scenes without the field keep their old structural continuation until an author edits or publishes them.

**Tech Stack:** Browser ES modules, DOM UI, Node test runner, JSDOM, Vite/TypeScript build verification.

## Global Constraints

- Interactive pictures still cannot contain a reader-selectable choice group; `nextNodeId` is one fixed exit.
- Persist node IDs, never titles or array positions.
- Conditional/hidden nodes and the scene's own node are not valid continuation targets.
- Deleted or ambiguous targets must be reported; the reader must not guess a replacement.
- Existing imported works without `nextNodeId` remain readable through the legacy structural fallback, but editing and publishing require choosing a target.
- Use neutral relationship terminology in system and tutorial copy.

---

### Task 1: Scene Data and Validation

**Files:**
- Modify: `js/interactive-scene-model.js`
- Modify: `js/work-preflight.js`
- Test: `tests/interactive-scene-model.test.mjs`
- Test: `tests/work-preflight.test.mjs`

**Interfaces:**
- Consumes: raw interactive-scene records and article node collections.
- Produces: normalized `scene.nextNodeId: string` and publish issues for missing/invalid targets.

- [ ] **Step 1: Write failing normalization and preflight tests**

```js
assert.equal(normalizeInteractiveScene({ nextNodeId: "node-9" }).nextNodeId, "node-9")
assert.equal(inspectWork({ interactiveScenes: [{ nextNodeId: "" }] }).blockingCount, 1)
```

- [ ] **Step 2: Run tests and verify the field and issues are absent**

Run: `node --test tests/interactive-scene-model.test.mjs tests/work-preflight.test.mjs`

- [ ] **Step 3: Normalize the stable target and inspect it**

```js
return {
  ...normalizedScene,
  nextNodeId: identifier(source.nextNodeId, ""),
}
```

Preflight must emit `interactive-scene-next-node-missing` when blank and `interactive-scene-next-node-invalid` when the ID is missing, duplicated, conditional, or the owning scene node itself.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/interactive-scene-model.test.mjs tests/work-preflight.test.mjs`
Expected: PASS.

### Task 2: Required Editor Target

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `js/interactive-scene-editor.js`
- Modify: `css/styles.css` only if the existing field styles do not cover the selector.
- Test: `tests/interactive-scene-editor.test.mjs`
- Test: `tests/interactive-scene-node-ui.test.mjs`

**Interfaces:**
- Consumes: `options.targetGroups` in chapter order.
- Produces: `normalized.nextNodeId` in `onSave(scene)`.

- [ ] **Step 1: Write failing editor tests**

```js
assert.ok(overlay.querySelector('[data-scene-next-node]'))
assert.equal(overlay.querySelector('[data-scene-next-node]').required, true)
save.click()
assert.match(status.textContent, /后续跳转/)
```

- [ ] **Step 2: Run tests and verify the selector is absent**

Run: `node --test tests/interactive-scene-editor.test.mjs tests/interactive-scene-node-ui.test.mjs`

- [ ] **Step 3: Pass eligible chapter-grouped targets from the article editor**

```js
targetGroups: buildSceneContinuationTargetGroups(work, scene.nodeId)
```

Exclude conditional nodes, duplicate IDs, and the scene's own node. Retain the selected deleted target as a disabled “已失效” option so the author understands what must be repaired.

- [ ] **Step 4: Render and validate the required selector**

```js
const nextNode = documentObject.createElement("select")
nextNode.required = true
nextNode.dataset.sceneNextNode = ""
nextNode.addEventListener("change", () => { scene.nextNodeId = nextNode.value })
```

Block save, announce “请选择互动图片完成后的后续跳转节点”, switch to the stage pane on mobile, and focus the selector when empty or invalid.

- [ ] **Step 5: Update explanatory copy**

State that the last picture always goes to the selected fixed node; branches must be authored on that later ordinary node.

- [ ] **Step 6: Run editor tests**

Run: `node --test tests/interactive-scene-editor.test.mjs tests/interactive-scene-node-ui.test.mjs`
Expected: PASS.

### Task 3: Reader Fixed Exit

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-interactive-scene-node.test.mjs`

**Interfaces:**
- Consumes: `scene.nextNodeId`.
- Produces: a route truncated at the scene and appended to the explicit target using `appendArticleChoice`.

- [ ] **Step 1: Write failing route tests**

```js
// node 5 is followed structurally by 6 and 7 but explicitly targets 9.
assert.match(readerText, /Text 9/)
assert.doesNotMatch(readerText, /Text [67]/)
```

Also test a cross-chapter target and an invalid/deleted target.

- [ ] **Step 2: Run the reader test and verify it still follows structure**

Run: `node --test tests/reader-interactive-scene-node.test.mjs`

- [ ] **Step 3: Route final completion through the explicit target**

```js
const transition = scene.nextNodeId
  ? appendArticleChoice(nodes, path, scenePathIndex, scene.nextNodeId, articleRuntimeOptions())
  : continueArticleChapterPath(nodes, path, scenePathIndex, articleRuntimeOptions())
```

The second branch is legacy-only. When a nonblank explicit target is invalid, render a clear broken-continuation state rather than going home or following structure.

- [ ] **Step 4: Run reader tests**

Run: `node --test tests/reader-interactive-scene-node.test.mjs`
Expected: PASS.

### Task 4: Tutorial and Complete Verification

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: completed behavior from Tasks 1–3.
- Produces: tutorial copy matching the shipped editor and reader.

- [ ] **Step 1: Update tutorial tests and copy**

Document “最后画面 → 必选固定后续节点”, stable node movement/renaming, deleted-target repair, and placing any later choice group on the selected ordinary node.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
node --test tests/interactive-scene-model.test.mjs tests/interactive-scene-editor.test.mjs tests/interactive-scene-node-ui.test.mjs tests/reader-interactive-scene-node.test.mjs tests/work-preflight.test.mjs tests/resources-page.test.mjs
```

- [ ] **Step 3: Run complete verification**

Run:

```powershell
npm test
npm run build:verify
```

Expected: zero test failures and successful production builds.
