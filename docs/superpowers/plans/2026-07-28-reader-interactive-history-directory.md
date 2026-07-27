# Reader Interactive History Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing read-only journey rows inside `阅读记录` into an interactive directory that can preview already visited story fragments without changing the active save.

**Architecture:** Extend the pure journey-insights module with a route-order projection that exposes only nodes and decisions present in the selected save. The book manager renders that projection as one restrained ordered list and reuses the existing read-only preview surface with article text from the unlocked-search index. Preview actions never call library persistence or article navigation.

**Tech Stack:** Vanilla JavaScript, CSS, Node test runner, JSDOM, Vite.

## Global Constraints

- Keep the feature inside the existing `阅读记录` disclosure; do not add a top-level page, tab, or manager section.
- Include only nodes and choices recorded by the selected save; never reveal unvisited nodes or unused choices.
- Opening and closing a preview must not change the active slot, route, progress, checkpoints, bookmarks, placeholders, or completion state.
- Keep checkpoint rollback and route comparison behavior unchanged.
- Preserve keyboard focus return, mobile layout, dark themes, reduced motion, and cache-missing behavior.

---

### Task 1: Project the current save into route-order directory entries

**Files:**
- Modify: `reader/reader-journey-insights.js`
- Modify: `tests/reader-journey-insights.test.mjs`

**Interfaces:**
- Consumes: normalized article work plus one reader slot with article progress.
- Produces: `readerJourneyDirectory(work, slot)` returning visited route entries with selected branch and interaction decisions.

- [ ] **Step 1: Write the failing projection test**

```js
const directory = readerJourneyDirectory(work, {
  progress:{
    kind:"article",
    path:["start", "lighthouse"],
    choiceMemory:{start:"left"},
    interactionSelections:{
      inspect:{nodeId:"start", choiceId:"inspect-clock"},
    },
  },
})
assert.deepEqual(directory.map(entry => entry.nodeId), ["start", "lighthouse"])
assert.deepEqual(directory[0].decisions.map(item => item.label), [
  "走向灯塔",
  "检查停住的钟",
])
assert.equal(JSON.stringify(directory).includes("未解锁密室"), false)
```

- [ ] **Step 2: Run the focused test and verify the missing export failure**

Run: `node --test tests/reader-journey-insights.test.mjs`

Expected: FAIL because `readerJourneyDirectory` is not exported.

- [ ] **Step 3: Implement exact route and decision projection**

```js
export function readerJourneyDirectory(work, slot) {
  const progress = articleProgress(slot)
  if (!record(work) || work.type === "phone" || !progress) return []
  const {nodes, chapters} = journeyIndexes(work)
  return progress.path.flatMap((nodeId, pathIndex) => {
    const node = nodes.get(nodeId)
    if (!node) return []
    return [{
      nodeId,
      pathIndex,
      chapterTitle:string(chapters.get(string(node.chapterId))?.name).trim(),
      title:string(node.title).trim() || "阅读片段",
      decisions:selectedJourneyDecisions(node, progress),
    }]
  })
}
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/reader-journey-insights.test.mjs`

Expected: PASS with route order preserved and unvisited content absent.

### Task 2: Render the directory and bind non-mutating previews

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-interactive-history-directory.test.mjs`

**Interfaces:**
- Consumes: `readerJourneyDirectory`, `buildUnlockedReaderSearchIndex`, and the existing read-only preview.
- Produces: `[data-reader-journey-entry]` buttons inside `.rd-reader-record` and preview focus restoration.

- [ ] **Step 1: Write the failing manager integration test**

```js
const progressBefore = localStorage.getItem(READER_LIBRARY_STORAGE_KEY)
document.querySelector(".rd-reader-record summary").click()
const entry = document.querySelector("[data-reader-journey-entry]")
entry.click()
assert.match(document.querySelector(".rd-reader-search-preview").textContent, /已解锁正文/)
document.querySelector("[data-reader-search-preview-close]").click()
assert.equal(document.activeElement, entry)
assert.equal(localStorage.getItem(READER_LIBRARY_STORAGE_KEY), progressBefore)
```

- [ ] **Step 2: Run the integration test and verify the missing button failure**

Run: `node --test tests/reader-interactive-history-directory.test.mjs`

Expected: FAIL because the existing history rows are not interactive.

- [ ] **Step 3: Render an ordered directory inside `阅读记录`**

```js
h += '<section><h4>互动目录</h4>'
h += '<p class="rd-reader-record-note">只回看当前存档已经走过的片段，不会切换路线。</p>'
h += '<ol class="rd-reader-journey-directory">'
directory.forEach((entry, index) => {
  h += '<li><button type="button" data-reader-journey-entry="' + index + '">...</button></li>'
})
h += '</ol></section>'
```

- [ ] **Step 4: Bind the existing read-only preview without persistence**

```js
overlay.querySelectorAll("[data-reader-journey-entry]").forEach(button => {
  button.onclick = function() {
    const entry = directory[Number(button.dataset.readerJourneyEntry)]
    const preview = articlePreviewByNodeId.get(entry.nodeId)
    if (!entry || !preview) return
    openReaderUnlockedSearchPreview({
      ...preview,
      title:entry.title,
      location:[entry.chapterTitle, entry.title].filter(Boolean).join(" · "),
    }, button)
  }
})
```

- [ ] **Step 5: Add restrained responsive list styling**

```css
.rd-reader-journey-directory {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--c-border);
}
.rd-reader-journey-directory button {
  width: 100%;
  min-height: 56px;
  text-align: left;
}
```

- [ ] **Step 6: Run directory and existing manager tests**

Run: `node --test tests/reader-interactive-history-directory.test.mjs tests/reader-library-tools-ui.test.mjs`

Expected: PASS with the directory inside `阅读记录`, preview focus restored, and storage bytes unchanged.

### Task 3: Regression and visual verification

**Files:**
- Verify: `reader/reader-journey-insights.js`
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `tests/**/*.test.mjs`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a verified reader build.

- [ ] **Step 1: Run focused journey and manager tests**

Run: `node --test tests/reader-journey-insights.test.mjs tests/reader-interactive-history-directory.test.mjs tests/reader-library-tools-ui.test.mjs`

Expected: zero failures.

- [ ] **Step 2: Inspect desktop and 390px mobile manager layouts**

Expected: the ordered list remains inside `阅读记录`, decision copy wraps without overflow, and the preview close control remains visible.

- [ ] **Step 3: Run the complete suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 4: Run the production build**

Run: `npm run build:verify`

Expected: exit code 0.

- [ ] **Step 5: Review the scoped diff**

Run: `git diff --check -- reader/reader-journey-insights.js reader/reader.js reader/reader.css`

Expected: no whitespace errors.
