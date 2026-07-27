# Reader Unlocked Search and Immersive Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers search only content unlocked by the active article route and replace the scattered fixed reading controls with one compact, dismissible toolbar.

**Architecture:** A focused pure module builds and queries a search index from the active article path plus message, forum, and memo modules owned by those nodes. The existing reader runtime owns the search drawer, temporary read-only result preview, focus restoration, and immersive toolbar state so no search action mutates progress. Existing back, bookmark, and appearance controls keep their current data attributes and handlers inside the new toolbar.

**Tech Stack:** Vanilla JavaScript, CSS, Node test runner, JSDOM, Vite.

## Global Constraints

- Search only nodes in the active `_articlePath`; never index unvisited nodes or phone modules owned by them.
- Include article prose and unlocked message, forum, and memo module text; exclude identifiers, URLs, and unsupported phone Apps.
- Search previews are read-only and must not mutate the route, choices, checkpoints, bookmarks, or saved progress.
- Do not add excerpts, reading statistics, system narration, AI calls, or a new home/settings section.
- The toolbar must preserve keyboard access, safe-area insets, reduced motion, and the existing back/bookmark/appearance behaviors.

---

### Task 1: Build the unlocked-content search boundary

**Files:**
- Create: `reader/reader-unlocked-search.js`
- Create: `tests/reader-unlocked-search.test.mjs`

**Interfaces:**
- Consumes: normalized article work data, active path, choice memory, and interaction selections.
- Produces: `buildUnlockedReaderSearchIndex(work, path, state)` and `searchUnlockedReaderIndex(entries, query, limit)`.

- [ ] **Step 1: Write failing boundary and matching tests**

```js
const entries = buildUnlockedReaderSearchIndex(work, ["start"], {
  choiceMemory:{},
  interactionSelections:{},
})
assert.match(entries.map(entry => entry.text).join(" "), /已解锁正文/)
assert.doesNotMatch(entries.map(entry => entry.text).join(" "), /未解锁秘密/)
assert.deepEqual(
  [...new Set(entries.map(entry => entry.kind))],
  ["article", "messages", "forum", "memo"],
)
assert.equal(searchUnlockedReaderIndex(entries, "秘密").length, 0)
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `node --test tests/reader-unlocked-search.test.mjs`

Expected: FAIL because `reader-unlocked-search.js` does not exist.

- [ ] **Step 3: Implement exact route filtering and safe text extraction**

```js
export function buildUnlockedReaderSearchIndex(work, path, state = {}) {
  const unlocked = new Set(Array.isArray(path) ? path : [])
  const articleEntries = articleSearchEntries(work, path, state)
  const phoneEntries = phoneSearchEntries(work, unlocked)
  return [...articleEntries, ...phoneEntries]
}

export function searchUnlockedReaderIndex(entries, query, limit = 50) {
  const needle = String(query || "").trim().toLocaleLowerCase()
  if (!needle) return []
  return entries
    .flatMap(entry => searchEntry(entry, needle))
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/reader-unlocked-search.test.mjs`

Expected: PASS with locked nodes, locked modules, IDs, and URLs absent from results.

### Task 2: Add search drawer and temporary result preview

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-unlocked-search-ui.test.mjs`

**Interfaces:**
- Consumes: `buildUnlockedReaderSearchIndex` and `searchUnlockedReaderIndex`.
- Produces: `openReaderUnlockedSearch(triggerElement)`, a non-mutating search drawer, and a temporary read-only preview.

- [ ] **Step 1: Write failing reader integration tests**

```js
document.querySelector("[data-reader-search]").click()
const input = document.querySelector("[data-reader-unlocked-search-input]")
input.value = "站台"
input.dispatchEvent(new Event("input", {bubbles:true}))
assert.match(document.querySelector(".rd-reader-search-results").textContent, /第一章/)
document.querySelector("[data-reader-search-result]").click()
assert.ok(document.querySelector(".rd-reader-search-preview"))
assert.deepEqual(savedProgress(), progressBeforeSearch)
```

- [ ] **Step 2: Run the integration test and confirm the missing control failure**

Run: `node --test tests/reader-unlocked-search-ui.test.mjs`

Expected: FAIL because `[data-reader-search]` is absent.

- [ ] **Step 3: Implement the drawer, literal matching, preview, and focus return**

```js
function openReaderUnlockedSearch(triggerElement) {
  var readingPosition = captureArticleReadingPosition()
  var entries = currentUnlockedReaderSearchIndex()
  var panel = renderReaderSearchPanel(entries)
  bindReaderSearchPanel(panel, entries, {
    onClose:function() {
      panel.remove()
      restoreArticleReadingPosition(readingPosition)
      triggerElement?.focus()
    },
  })
}
```

- [ ] **Step 4: Add restrained responsive styling**

```css
.rd-reader-search-panel {
  position: fixed;
  right: 16px;
  bottom: calc(var(--reader-safe-bottom) + 82px);
  width: min(420px, calc(100vw - 32px));
}
@media (max-width: 600px) {
  .rd-reader-search-panel {
    right: 12px;
    bottom: calc(var(--reader-safe-bottom) + 74px);
    width: calc(100vw - 24px);
  }
}
```

- [ ] **Step 5: Run the search UI tests**

Run: `node --test tests/reader-unlocked-search-ui.test.mjs`

Expected: PASS with route persistence unchanged before and after preview.

### Task 3: Consolidate article controls into an immersive toolbar

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-immersive-toolbar.test.mjs`

**Interfaces:**
- Consumes: existing `data-reader-home`, `data-reader-previous`, `data-reader-bookmark-current`, and reader appearance handlers.
- Produces: `bindArticleImmersiveToolbar()` and `cleanupArticleImmersiveToolbar()`.

- [ ] **Step 1: Write failing toolbar interaction tests**

```js
const toolbar = document.querySelector("[data-reader-immersive-toolbar]")
assert.ok(toolbar)
assert.equal(document.querySelectorAll(".reader-back").length, 1)
document.querySelector(".article-content p").click()
assert.equal(toolbar.getAttribute("aria-hidden"), "true")
document.querySelector("[data-reader-immersive-reveal]").click()
assert.equal(toolbar.getAttribute("aria-hidden"), "false")
```

- [ ] **Step 2: Run the toolbar test and confirm the missing toolbar failure**

Run: `node --test tests/reader-immersive-toolbar.test.mjs`

Expected: FAIL because the immersive toolbar is absent.

- [ ] **Step 3: Render and bind the consolidated controls**

```js
function setArticleImmersiveToolbarVisible(visible, focusFirst) {
  toolbar.classList.toggle("is-visible", visible)
  toolbar.setAttribute("aria-hidden", String(!visible))
  reveal.hidden = visible
  controls.forEach(control => control.tabIndex = visible ? 0 : -1)
  if (visible && focusFirst) controls[0]?.focus()
}
```

- [ ] **Step 4: Add tap, scroll, Escape, and Ctrl/Cmd+F behavior**

```js
articleReader.addEventListener("click", event => {
  if (window.getSelection()?.toString()) return
  if (event.target.closest("button,a,input,textarea,select,[role='button']")) return
  setArticleImmersiveToolbarVisible(!toolbar.classList.contains("is-visible"))
})
```

- [ ] **Step 5: Style desktop and mobile toolbar states**

```css
.reader-immersive-toolbar {
  position: fixed;
  left: 50%;
  bottom: calc(var(--reader-safe-bottom) + 16px);
  display: flex;
  transform: translate(-50%, 8px);
  transition: opacity .18s ease-out, transform .18s ease-out;
}
```

- [ ] **Step 6: Run toolbar and existing navigation tests**

Run: `node --test tests/reader-immersive-toolbar.test.mjs tests/reader-critical-flow.test.mjs tests/reader-mobile-viewport.test.mjs`

Expected: PASS with one working back control, bookmark, appearance, search, safe-area placement, and no duplicate navigation.

### Task 4: Regression and visual verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `reader/reader-unlocked-search.js`
- Verify: `tests/**/*.test.mjs`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a verified production build.

- [ ] **Step 1: Run focused search and toolbar tests**

Run: `node --test tests/reader-unlocked-search.test.mjs tests/reader-unlocked-search-ui.test.mjs tests/reader-immersive-toolbar.test.mjs`

Expected: PASS.

- [ ] **Step 2: Inspect desktop and 390px mobile layouts in the local reader**

Expected: the toolbar and search drawer remain inside safe areas, search preview does not cover its close control, and hidden controls cannot receive focus.

- [ ] **Step 3: Run the complete suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 5: Review the plan and diff**

Run: `git diff --check` and `rg -n "TODO|TBD|FIXME" docs/superpowers/plans/2026-07-28-reader-unlocked-search-immersive-toolbar.md reader/reader-unlocked-search.js`

Expected: no whitespace errors or incomplete markers.
