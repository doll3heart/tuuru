# Local Editor Color and Author Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only author text color and a private outline/worldbuilding workspace to the article editor.

**Architecture:** Extend the existing per-work article view record for display-only color and side-panel selection. Store author writing material in a separate versioned local-storage document keyed by work ID; the individual-work serializer never reads either key, while whole-device migration includes both keys.

**Tech Stack:** Browser ES modules, localStorage, delegated DOM events, responsive CSS, JSDOM, Node test runner.

## Global Constraints

- The author text color changes only the article authoring surface.
- Author text color and outline material must not be written into `tuuru_works`.
- JSON/PNG work exports and reader rendering must remain unchanged.
- Whole-device migration carries local editor state and private writing material.
- Mobile article tabs are ordered `正文｜设定｜结构`.
- Desktop keeps `快捷栏｜正文编辑器｜右侧栏`; the right side switches between `结构` and `设定`.
- Existing dirty interactive-scene work must be preserved.

---

### Task 1: Normalize local appearance and private writing material

**Files:**
- Modify: `js/article-editor-view-state.js`
- Create: `js/article-author-notes.js`
- Modify: `tests/article-editor-view-state.test.mjs`
- Create: `tests/article-author-notes.test.mjs`

**Interfaces:**
- `readArticleEditorViewState()` returns `editorTextColor` and `sidePane` in addition to existing fields.
- `writeArticleAuthorNotes(workId, patch, storage)` stores `outline`, `worldbuilding`, `characters`, and `ideas`.

- [ ] **Step 1: Add failing normalization tests**

```js
assert.deepEqual(
  writeArticleEditorViewState("work", { editorTextColor:"#5A3344", sidePane:"notes" }, storage),
  {
    nodeId:"",
    collapsedChapterIds:[],
    collapsedChoiceNodeIds:[],
    editorTextColor:"#5a3344",
    sidePane:"notes",
    noteSection:"outline",
  },
)
assert.deepEqual(
  writeArticleAuthorNotes("work", { outline:"第一幕", future:"drop" }, storage),
  { outline:"第一幕", worldbuilding:"", characters:"", ideas:"" },
)
```

- [ ] **Step 2: Run the focused tests and observe missing fields/module**

Run: `node --test tests/article-editor-view-state.test.mjs tests/article-author-notes.test.mjs`

Expected: FAIL because the notes module and new normalized fields do not exist.

- [ ] **Step 3: Implement strict local normalization**

```js
function color(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : ""
}

const EMPTY_NOTES = Object.freeze({
  outline:"",
  worldbuilding:"",
  characters:"",
  ideas:"",
})
```

The notes writer merges a patch with the current normalized record, accepts only these four string fields, caps each field at 200,000 UTF-16 code units, and catches denied storage.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/article-editor-view-state.test.mjs tests/article-author-notes.test.mjs`

Expected: PASS.

### Task 2: Local author text color

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Modify: `tests/article-editor-mobile-shell.test.mjs`

**Interfaces:**
- Consumes `editorTextColor` from Task 1.
- Produces desktop and mobile `input[type=color][data-a="fs-color"]` controls and `data-a="fs-color-reset"`.

- [ ] **Step 1: Add a failing editor integration test**

```js
const beforeWork = localStorage.getItem("tuuru_works")
const color = root.querySelector('[data-a="fs-color"]')
color.value = "#5a3344"
color.dispatchEvent(new Event("change", { bubbles:true }))
assert.equal(root.querySelector(".content-editable").style.color, "rgb(90, 51, 68)")
assert.equal(localStorage.getItem("tuuru_works"), beforeWork)
```

- [ ] **Step 2: Run the mobile-shell test and observe the missing control**

Run: `node --test tests/article-editor-mobile-shell.test.mjs`

Expected: FAIL because no local color control exists.

- [ ] **Step 3: Render and handle the local color**

Read the local view record in `buildToolbar`, `buildMobileCommandbar`, and `buildContent`. A valid color is applied as the editable element's inline `color`; change events update only `tuuru_article_editor_view`, and reset removes the local color before rerendering.

- [ ] **Step 4: Run the mobile-shell tests**

Run: `node --test tests/article-editor-mobile-shell.test.mjs`

Expected: PASS.

### Task 3: Responsive private outline workspace

**Files:**
- Modify: `js/editor-mobile-pane.js`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Modify: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `tests/article-outline-accessibility.test.mjs`

**Interfaces:**
- `applyEditorMobilePane(root, "notes")` selects the middle mobile tab.
- The existing `.world-tree` remains the resizable right-side container and contains `#articleNotesPane` plus `#articleOutlinePane`.
- Notes textareas use `data-author-note` with one of `outline`, `worldbuilding`, `characters`, or `ideas`.

- [ ] **Step 1: Add failing pane and persistence tests**

```js
assert.equal(applyEditorMobilePane(root, "notes"), true)
assert.equal(root.dataset.mobilePane, "notes")

const notesTab = root.querySelector('[data-a="side-pane"][data-pane="notes"]')
notesTab.click()
const outline = root.querySelector('[data-author-note="outline"]')
outline.value = "第一幕：相遇"
outline.dispatchEvent(new Event("input", { bubbles:true }))
assert.equal(readArticleAuthorNotes(work.id, localStorage).outline, "第一幕：相遇")
assert.equal(localStorage.getItem("tuuru_works"), beforeWork)
```

- [ ] **Step 2: Run the editor tests and observe missing notes pane behavior**

Run: `node --test tests/article-editor-mobile-shell.test.mjs tests/article-outline-accessibility.test.mjs`

Expected: FAIL because `"notes"` is not a valid pane and no notes surface exists.

- [ ] **Step 3: Build the side-panel tabs and author workspace**

Desktop renders `结构` and `设定` tab buttons at the top of the existing right panel. The notes pane renders four category buttons, one corresponding textarea, and the persistent copy `仅作者本机，不随作品导出`; delegated input handling writes only the private notes key and updates an `aria-live` save state.

- [ ] **Step 4: Add bounded responsive behavior**

At the existing article-editor mobile breakpoint, both `outline` and `notes` hide the center editor and mobile writing dock. The mobile primary tabs render in the exact order `正文`, `设定`, `结构`; desktop side tabs remain inside the resizable right panel.

- [ ] **Step 5: Run editor tests**

Run: `node --test tests/article-author-notes.test.mjs tests/article-editor-view-state.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-outline-accessibility.test.mjs`

Expected: PASS.

### Task 4: Whole-device migration without work-export leakage

**Files:**
- Modify: `js/local-profile-transport.js`
- Modify: `tests/local-profile-transport.test.mjs`
- Modify: `tests/work-transport-parity.test.mjs`

**Interfaces:**
- Whole-device author settings accept `tuuru_article_editor_view` and `tuuru_article_author_notes`.
- `exportWorkAsJSON()` remains unaware of both keys.

- [ ] **Step 1: Add migration and isolation assertions**

```js
storage.setItem("tuuru_article_editor_view", '{"version":1,"works":{}}')
storage.setItem("tuuru_article_author_notes", '{"version":1,"works":{}}')
const profile = JSON.parse(serializeLocalProfile(storage, now))
assert.equal(typeof profile.authorSettings.tuuru_article_editor_view, "string")
assert.equal(typeof profile.authorSettings.tuuru_article_author_notes, "string")
assert.doesNotMatch(exportWorkAsJSON(work.id), /article_author_notes|editorTextColor/)
```

- [ ] **Step 2: Run transport tests and observe missing migration keys**

Run: `node --test tests/local-profile-transport.test.mjs tests/work-transport-parity.test.mjs`

Expected: FAIL because the author setting allowlist does not include the new local keys.

- [ ] **Step 3: Add both exact keys to the author setting allowlist**

```js
const AUTHOR_SETTING_KEYS = new Set([
  "tuuru_theme",
  "tuuru_author_placeholder_presets",
  "tuuru_author_npc_packs",
  "tuuru_editor_split",
  "tuuru_article_editor_view",
  "tuuru_article_author_notes",
])
```

- [ ] **Step 4: Run focused tests and production verification**

Run: `node --test tests/local-profile-transport.test.mjs tests/work-transport-parity.test.mjs`

Expected: PASS.

Run: `npm run verify`

Expected: all tests and production build PASS.
