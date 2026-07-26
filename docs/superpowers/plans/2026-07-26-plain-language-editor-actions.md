# Plain Language Editor Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scene creation and chapter actions discoverable, remove redundant node up/down buttons, and rewrite the interactive-article tutorial in direct click-by-click language.

**Architecture:** Reuse the existing scene data functions and the existing node drag controller. Scene creation will live inside the node’s scene selector as an explicit “新建场景” action, so it fits desktop and mobile without adding another toolbar row. Node action panels keep cross-chapter movement, rename, conditions, and delete; ordering is handled only by drag.

**Tech Stack:** Browser JavaScript, delegated DOM events, CSS, Node test runner, JSDOM.

## Global Constraints

- Do not change reader behavior, work export fields, or scene-lock semantics.
- Use visible UI words in the tutorial; avoid internal terms such as “章节操作”.
- Write instructions as “where to look → what to click → what appears”.
- Keep the unrelated `.impeccable/critique` file untouched.

---

### Task 1: Add a real scene-creation path

**Files:**
- Modify: `js/pages/editor.js`
- Test: `tests/article-hidden-node-editor.test.mjs`

**Interfaces:**
- Consumes: `addScene(workId, name)` and `updateNode(workId, nodeId, { scene })`.
- Produces: a scene `<select data-a="ss">` containing `value="__add_scene__"` and a prompt-backed creation flow.

- [x] **Step 1: Write the failing test**

Add a test that renders the editor, selects `__add_scene__`, enters “雨夜”, confirms, and asserts that the scene exists and is selected on the current node.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/article-hidden-node-editor.test.mjs`

Expected: FAIL because the selector has no `__add_scene__` option.

- [x] **Step 3: Implement the minimal scene flow**

Render the selector with plain labels:

```js
<option value="">不使用场景</option>
<option value="scene-id">场景：场景名</option>
<option value="__add_scene__">＋ 新建场景…</option>
```

When the sentinel is selected, open `showPrompt("新建场景", "例如：雨夜")`; after confirmation, call `addScene`, assign the returned ID to the current node, and refresh.

- [x] **Step 4: Run the focused test**

Run: `node --test tests/article-hidden-node-editor.test.mjs`

Expected: PASS.

### Task 2: Remove redundant node up/down actions

**Files:**
- Modify: `js/pages/editor.js`
- Test: `tests/article-outline-accessibility.test.mjs`

**Interfaces:**
- Consumes: the existing pointer-based drag controller.
- Produces: node menus containing only `移至…`, `条件` when relevant, `重命名`, and `删除`.

- [x] **Step 1: Change the outline test first**

Assert that ordinary-node action buttons are `["rn2", "dl"]`, with no `data-a="up"` or `data-a="dn"`.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/article-outline-accessibility.test.mjs`

Expected: FAIL because the old arrow buttons still render.

- [x] **Step 3: Remove the obsolete UI and command path**

Delete the arrow button HTML, `up` / `dn` click branches, and the now-unused `moveNode` helper. Keep `移至…` for direct cross-chapter moves.

- [x] **Step 4: Run the focused test**

Run: `node --test tests/article-outline-accessibility.test.mjs`

Expected: PASS.

### Task 3: Make chapter actions visible and rewrite the tutorial

**Files:**
- Modify: `css/styles.css`
- Modify: `js/pages/resources.js`
- Test: `tests/article-outline-accessibility.test.mjs`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Produces: an always-visible chapter `…` button and direct author instructions using the on-screen labels.

- [x] **Step 1: Add failing copy and CSS assertions**

Require a visible desktop chapter disclosure and tutorial phrases covering:

```text
右侧“结构”
章节名右边的“…”按钮
点“隐”
点顶部的“场景：…”
点“＋ 新建场景…”
按住节点左边的“⠿”拖动
```

- [x] **Step 2: Run both focused tests and confirm failure**

Run: `node --test tests/article-outline-accessibility.test.mjs tests/resources-page.test.mjs`

- [x] **Step 3: Implement the visible chapter menu and plain-language copy**

Keep the chapter `…` disclosure visible on fine-pointer layouts and allow its existing open state to reveal the action panel. Rewrite the interactive-article guide, feature entries, and FAQ so every path names the exact visible label.

- [x] **Step 4: Run focused and full verification**

Run:

```text
node --test tests/article-hidden-node-editor.test.mjs tests/article-outline-accessibility.test.mjs tests/resources-page.test.mjs
npm test
npm run build:verify
```

Expected: all tests and the production build pass.
