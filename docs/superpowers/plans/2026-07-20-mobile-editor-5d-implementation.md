# Mobile Editor 5D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bounded-phone article editor shell with the selected 5D compact tree layout while preserving the existing desktop editor and data model.

**Architecture:** Keep the current `editor-mobile-pane.js` state switch and existing world-tree/drag controllers. Change only the mobile navigation markup, add an inline chapter creator inside the existing tree, and apply 5D styling inside the bounded-mobile media query so desktop coexistence remains unchanged.

**Tech Stack:** Vanilla JavaScript, CSS, JSDOM, Node test runner, Vite.

## Global Constraints

- The primary mobile pages are labelled `正文` and `结构`.
- Visible controls stay visually compact while interactive targets remain at least 44×44px.
- Chapter creation is inline and must not call browser `prompt`, `confirm`, or `alert`.
- Existing node IDs, choice links, chapter assignments, local persistence, and desktop editor structure remain intact.
- No deployment or push occurs before local visual and automated verification.

---

### Task 1: Lock the selected shell contract with failing tests

**Files:**
- Modify: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `tests/article-outline-accessibility.test.mjs`

**Interfaces:**
- Consumes: `renderEditor(workId)` and delegated editor click handling.
- Produces: regression contracts for top page tabs, context-only mobile tools, inline chapter creation, and no native editor dialogs.

- [ ] **Step 1: Replace the old four-button dock assertions**

```js
assert.deepEqual(
  [...root.querySelectorAll(".editor-mobile-view-switch [data-a='mobile-pane']")]
    .map(button => button.textContent.trim()),
  ["正文", "结构"],
)
assert.deepEqual(
  [...root.querySelectorAll(".editor-mobile-dock [data-a='mobile-tools']")]
    .map(button => button.getAttribute("aria-label")),
  ["插入内容", "文字格式"],
)
```

- [ ] **Step 2: Add an inline chapter creation regression**

```js
const addChapter = root.querySelector('[data-a="as"]')
addChapter.click()
const creator = root.querySelector(".wt-chapter-create")
assert.equal(creator.hidden, false)
creator.querySelector("input").value = "New chapter"
creator.querySelector('[data-a="chapter-create-confirm"]').click()
assert.ok(getWork(work.id).chapters.some(chapter => chapter.name === "New chapter"))
```

- [ ] **Step 3: Add a native-dialog source guard**

```js
assert.doesNotMatch(editorSource, /\b(?:prompt|confirm|alert)\s*\(/)
```

- [ ] **Step 4: Run focused tests and confirm the new assertions fail**

Run: `node --test tests/article-editor-mobile-shell.test.mjs tests/article-outline-accessibility.test.mjs`

Expected: FAIL because the current dock still contains four labelled buttons, the page label is `大纲`, chapter creation calls `prompt`, and no inline creator exists.

### Task 2: Implement the 5D mobile shell and inline chapter creator

**Files:**
- Modify: `js/pages/editor.js`

**Interfaces:**
- Consumes: `applyEditorMobilePane(root, pane)`, `updateWork(workId, patch)`, `uid()`, and the existing event delegation.
- Produces: `.editor-mobile-view-switch`, `.editor-mobile-commandbar`, `.wt-chapter-create`, and chapter count markup compatible with the existing tree.

- [ ] **Step 1: Rename the mobile secondary page and reduce the dock to contextual tools**

```js
h += '<button type="button" data-a="mobile-pane" data-pane="outline" ...>结构</button>'
h += '<button type="button" data-a="mobile-tools" data-panel="insert" aria-label="插入内容" ...><span aria-hidden="true">＋</span></button>'
h += '<button type="button" data-a="mobile-tools" data-panel="format" aria-label="文字格式" ...><span aria-hidden="true">Aa</span></button>'
```

- [ ] **Step 2: Render an inline creator immediately below the tree header**

```js
h += '<div class="wt-chapter-create" hidden>'
h += '<input type="text" maxlength="40" aria-label="新章节名称" placeholder="输入章节名称">'
h += '<button type="button" data-a="chapter-create-confirm" data-w="' + w.id + '">添加</button>'
h += '<button type="button" data-a="chapter-create-cancel">取消</button></div>'
```

- [ ] **Step 3: Handle opening, confirming, and cancelling without refreshing before input is read**

```js
if (a === "as") {
  var creator = b.closest(".world-tree")?.querySelector(".wt-chapter-create")
  creator.hidden = false
  creator.querySelector("input")?.focus()
  return
}
```

- [ ] **Step 4: Replace every editor-native confirm path with `showConfirm`**

Use the existing `showConfirm(title, message, onConfirm, onCancel)` helper for node, placeholder, option-group, and phone-module deletion so no editor action invokes a browser dialog.

- [ ] **Step 5: Run focused behavior tests**

Run: `node --test tests/article-editor-mobile-shell.test.mjs tests/article-outline-accessibility.test.mjs tests/article-node-drag-integration.test.mjs`

Expected: PASS.

### Task 3: Apply the 5D visual hierarchy inside the bounded mobile query

**Files:**
- Modify: `css/styles.css`
- Modify: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `tests/article-node-drag-integration.test.mjs`

**Interfaces:**
- Consumes: existing `.editor-body-area[data-mobile-pane]`, `.world-tree`, `.wt-chapter`, `.wt-node`, and `.wt-node-drag-handle` DOM.
- Produces: compact top line tabs, a whitespace-based tree, persistent drag affordances, and a contextual writing toolbar.

- [ ] **Step 1: Style top page tabs as text plus a 2px active underline**

```css
.editor-mobile-view-switch{display:flex;min-height:44px;padding:0 8px;border-bottom:1px solid var(--c-border)}
.editor-mobile-view-switch button{position:relative;min-width:72px;min-height:44px;border:0;background:transparent}
.editor-mobile-view-switch button[aria-pressed="true"]::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:2px;background:var(--c-primary-hover)}
```

- [ ] **Step 2: Convert the mobile world tree from bordered rows to guide-line hierarchy**

```css
.world-tree .wt-chapter{position:relative;padding-left:10px}
.world-tree .wt-chapter::before{content:"";position:absolute;left:12px;top:34px;bottom:8px;width:1px;background:var(--c-border)}
.world-tree .wt-node{margin-left:16px;border-left:0}
.world-tree .wt-node::before{content:"";position:absolute;left:-14px;top:22px;width:14px;height:1px;background:var(--c-border)}
```

- [ ] **Step 3: Separate visible glyph size from the drag target**

```css
.world-tree .wt-node-drag-handle{width:44px;min-width:44px;min-height:44px;opacity:1;font-size:.72rem}
.world-tree .wt-node-drag-handle > span{width:28px;height:28px;display:grid;place-items:center}
```

- [ ] **Step 4: Show the compact context toolbar only on the writing page**

```css
.editor-mobile-dock{display:flex;min-height:52px;padding:0 6px}
.editor-mobile-dock > button{width:44px;min-width:44px;min-height:44px;border:0;background:transparent}
.editor-body-area[data-mobile-pane="outline"] .editor-mobile-commandbar{display:none}
```

- [ ] **Step 5: Run focused tests and CSS contract checks**

Run: `node --test tests/article-editor-mobile-shell.test.mjs tests/article-node-drag-integration.test.mjs`

Expected: PASS, including 44px drag targets and bounded-mobile structural selectors.

### Task 4: Verify the integrated editor

**Files:**
- Verify: `js/pages/editor.js`
- Verify: `css/styles.css`
- Verify: `tests/article-editor-mobile-shell.test.mjs`

**Interfaces:**
- Consumes: completed implementation.
- Produces: evidence for local review without deployment.

- [ ] **Step 1: Run the complete automated suite and production build**

Run: `npm run verify`

Expected: all Node tests pass and the build verification exits 0.

- [ ] **Step 2: Capture phone screenshots at 320px and 390px**

Open the sample article editor and verify both `正文` and `结构`: no horizontal overflow, top tabs remain visible, the current node is distinct, chapter lines do not collide with controls, and the writing toolbar appears only on `正文`.

- [ ] **Step 3: Exercise real interactions**

Create a chapter inline, drag a node within and across chapters, open/close both tool panels, select a node from `结构`, and confirm the editor returns to `正文` without losing content.

- [ ] **Step 4: Inspect repository scope**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the planned editor, CSS, tests, plan, and isolated prototype files are changed or untracked.
