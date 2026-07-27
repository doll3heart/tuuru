# Reader Import Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone reader import tab and open the existing Tuuru file importer in a compact, accessible overlay from bookshelf import actions.

**Architecture:** Keep file validation, decoding, and `importPayload` unchanged. Replace the import tab panel with one lazily-created `rd-import-overlay`; scope `setupImport(root)` to that overlay, restore focus on close, and close the overlay before a valid payload enters the existing import flow.

**Tech Stack:** Vanilla JavaScript, CSS, JSDOM tests, Node test runner, Vite.

## Global Constraints

- Keep exactly three reader-home tabs: personal, library, and customization.
- Keep `.tuuru`, `.json`, and `.png` support and existing size limits unchanged.
- Preserve a 44 px minimum touch target for all dialog controls.
- Support close button, backdrop click, Escape, focus containment, and focus restoration.
- Use one dialog instance at a time.

---

### Task 1: Lock the New Navigation and Dialog Contract

**Files:**
- Modify: `tests/reader-home-navigation.test.mjs`
- Modify: `tests/reader-bookshelf-ui.test.mjs`
- Modify: `tests/reader-import-resilience.test.mjs`

**Interfaces:**
- Consumes: existing `[data-reader-open-import]` bookshelf action.
- Produces: assertions for `.rd-import-overlay`, `.rd-import-dialog`, and the existing `#dropInner` importer.

- [ ] **Step 1: Write the failing navigation and dialog tests**

```js
assert.equal(tabs.length, 3)
assert.equal(document.querySelector('[data-tab="import"]'), null)
document.querySelector("[data-reader-open-import]").click()
const importDialog = document.querySelector(".rd-import-dialog")
assert.equal(importDialog.getAttribute("role"), "dialog")
assert.equal(importDialog.getAttribute("aria-modal"), "true")
assert.ok(importDialog.querySelector("#dropInner"))
```

- [ ] **Step 2: Update import resilience setup to open the bookshelf dialog**

```js
document.querySelector('[data-tab="library"]').click()
document.querySelector("[data-reader-open-import]").click()
```

- [ ] **Step 3: Run the focused tests and verify they fail against the old tab**

Run: `node --test tests/reader-home-navigation.test.mjs tests/reader-bookshelf-ui.test.mjs tests/reader-import-resilience.test.mjs`

Expected: FAIL because the home still renders four tabs and no import dialog.

### Task 2: Replace the Import Tab with a Scoped Dialog

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`

**Interfaces:**
- Consumes: `renderImportPanel()` and `setupImport(root)`.
- Produces: `openReaderImportDialog(invoker)` and `closeReaderImportDialog({ restoreFocus })`.

- [ ] **Step 1: Remove import tab markup and the eager importer setup**

```js
h += '<button ... data-tab="custom">美化</button>'
// No rdTabImport or tabImport panel.
```

- [ ] **Step 2: Add one accessible dialog instance**

```js
function openReaderImportDialog(invoker) {
  closeReaderImportDialog({restoreFocus:false})
  var overlay = document.createElement('div')
  overlay.className = 'rd-import-overlay'
  overlay.innerHTML =
    '<section class="rd-import-dialog" role="dialog" aria-modal="true" aria-labelledby="rdImportTitle" tabindex="-1">' +
    '<header class="rd-import-head"><div><span>添加到书架</span><h2 id="rdImportTitle">导入 Tuuru 作品</h2></div>' +
    '<button type="button" class="rd-import-close" aria-label="关闭导入作品">×</button></header>' +
    renderImportPanel() + '</section>'
  document.body.appendChild(overlay)
  setupImport(overlay)
}
```

- [ ] **Step 3: Scope importer selectors and close before handing off valid payloads**

```js
function setupImport(root) {
  root = root || document
  var inner = root.querySelector('#dropInner')
  var pickBtn = root.querySelector('#pickFileBtn')
  var fileInput = root.querySelector('#fileInput')
}

function importPayload(payload) {
  closeReaderImportDialog({restoreFocus:false})
  // Existing collection/work dispatch remains unchanged.
}
```

- [ ] **Step 4: Add compact desktop and bottom-sheet mobile styles**

```css
.rd-import-overlay{position:fixed;inset:0;z-index:2450;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(56,39,45,.48)}
.rd-import-dialog{width:min(480px,100%);max-height:calc(100vh - 40px);overflow:auto;border:1px solid var(--c-border2);border-radius:8px;background:var(--c-surface)}
.rd-import-dialog .drop-zone{min-height:0;padding:0}
.rd-import-dialog .drop-zone-inner{max-width:none;padding:34px 28px;border:0;border-radius:0}
```

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/reader-home-navigation.test.mjs tests/reader-bookshelf-ui.test.mjs tests/reader-import-resilience.test.mjs`

Expected: all tests pass.

### Task 3: Visual and Full Regression Verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`

**Interfaces:**
- Consumes: production reader route.
- Produces: verified desktop/mobile dialog behavior without changing import semantics.

- [ ] **Step 1: Inspect the reader home and dialog in the browser**

Verify: three tabs, import button opens one dialog, drag area is compact, close restores focus, and the dialog fits a narrow viewport.

- [ ] **Step 2: Run repository checks**

Run: `git diff --check`

Expected: exit 0.

Run: `npm run verify`

Expected: all tests pass and the production build succeeds.

- [ ] **Step 3: Review the final diff**

Run: `git diff -- reader/reader.js reader/reader.css tests/reader-home-navigation.test.mjs tests/reader-bookshelf-ui.test.mjs tests/reader-import-resilience.test.mjs`

Expected: only the import navigation, dialog, styles, and their tests change.

### Task 4: Inline Import Status and Errors

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-import-resilience.test.mjs`

**Interfaces:**
- Consumes: `setupImport(root)`, `readerImportFileError(file, ext)`, and the existing FileReader callbacks.
- Produces: `setReaderImportStatus(root, state, message)` where `state` is `idle`, `loading`, `error`, or `review`.

- [ ] **Step 1: Add failing tests for an inline error and loading state**

```js
openImportDialog()
dropFile(dom, {name:"too-large.json", size:10 * 1024 * 1024 + 1})
assert.equal(alerts.length, 0)
assert.equal(document.querySelector("[data-reader-import-status]").dataset.state, "error")

openImportDialog()
dropFile(dom, {name:"valid.json", size:1})
assert.equal(document.querySelector("[data-reader-import-status]").dataset.state, "loading")
assert.equal(document.getElementById("pickFileBtn").disabled, true)
```

- [ ] **Step 2: Route importer-local errors into the live region**

```js
function setReaderImportStatus(root, state, message) {
  var status = root.querySelector('[data-reader-import-status]')
  if (!status) return
  status.dataset.state = state
  status.textContent = message || ''
}
```

- [ ] **Step 3: Disable the picker only while FileReader is active**

```js
setReaderImportStatus(root, 'loading', '正在读取作品…')
pickBtn.disabled = true
// In every terminal callback:
pickBtn.disabled = false
```

- [ ] **Step 4: Keep parsing, schema, decryption, PNG, and storage failures visible in the dialog**

Use `setReaderImportStatus(root, 'error', message)` for errors that originate from the active import dialog; do not change unrelated reader alerts.

### Task 5: Confirm Same-Work Updates Without Losing Reader State

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-import-resilience.test.mjs`
- Test: `tests/reader-progress-persistence.test.mjs`

**Interfaces:**
- Consumes: `savedReaderBook(work.id)`, `prepareImportedWork(work)`, and `loadWork(work)`.
- Produces: `reviewReaderWorkImport(work)` and a `[data-reader-import-confirm]` action.

- [ ] **Step 1: Add a failing duplicate-import test**

```js
localStorage.setItem("moirain_readerLibrary", JSON.stringify(existingLibrary))
openImportDialog()
dropFile(dom, duplicateFile)
assert.match(document.querySelector(".rd-import-review").textContent, /检测到已有作品/)
assert.match(document.querySelector(".rd-import-review").textContent, /保留阅读进度与占位符/)
assert.equal(document.getElementById("rdStartBtn"), null)
```

- [ ] **Step 2: Show a review state before replacing the cached body**

```js
function reviewReaderWorkImport(work) {
  var previousBook = work.id ? savedReaderBook(work.id) : null
  if (!previousBook) {
    closeReaderImportDialog({restoreFocus:false})
    loadWork(work)
    return
  }
  // Render title, author, “更新正文”, and
  // “保留阅读进度与占位符” inside the current dialog.
}
```

- [ ] **Step 3: Confirm and preserve existing reader state**

```js
confirmButton.onclick = function() {
  closeReaderImportDialog({restoreFocus:false})
  loadWork(work)
}
```

`loadWork` must continue to read the previous library record before `rememberReaderWorkState(work)` so placeholder values, article progress, checkpoints, and phone flow index remain intact.

- [ ] **Step 4: Verify focused and full suites**

Run: `node --test tests/reader-import-resilience.test.mjs tests/reader-progress-persistence.test.mjs`

Expected: all tests pass.

Run: `npm run verify`

Expected: all tests pass and the production build succeeds.
