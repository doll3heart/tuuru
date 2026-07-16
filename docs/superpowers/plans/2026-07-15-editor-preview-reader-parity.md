# Editor Preview Reader Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the author SPA's duplicate article preview with a same-tab launch into the real reader, loading exactly one local author work in a read-only preview session.

**Architecture:** The author `/read/:id` route becomes a pure URL bridge to a real `reader/index.html` entry that ships inside the editor build. The reader detects an explicit `preview` query, reads the selected work through the existing local-database validation boundary, starts the existing reader runtime without caching the work or adding a recent, and routes reader-home controls back to the author app.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 6 multi-page build, Node.js `node:test`, JSDOM 27, existing local-storage validation and reader runtime.

## Global Constraints

- Change only the P0 author-preview parity path; do not implement any other UI backlog item.
- Keep the preview same-tab and full-page.
- Keep `reader/reader.js` as the only article/phone reader runtime.
- Never write preview work back to `tuuru_works`.
- Never write preview work to `moirain_work_<id>` or `moirain_recent`.
- Continue allowing reader-owned typography, appearance, profile, and placeholder-preference storage.
- Resolve the requested work by exact ID and fail closed when missing, ambiguous, invalid, corrupt, or unreadable.
- Preserve current JSON/PNG transport, schema, sanitization, password, placeholder, choice, phone-overlay, and character-connection behavior.
- Do not stage or commit pre-existing dirty worktree changes. Implementation verification may leave the scoped edits unstaged for the user to review.

## File Structure

- Modify `js/pages/reader.js`: replace the duplicate renderer with the author-side preview URL builder and redirect function.
- Modify `js/app.js`: make `/read/:id` invoke the redirect bridge without rendering the author header or old preview.
- Modify `vite.config.ts`: include `reader/index.html` in the editor multi-page build.
- Create `reader/editor-preview.js`: parse preview mode, read the validated author library, resolve exactly one work, and build the author-home return URL.
- Modify `reader/reader.js`: select ordinary-home versus editor-preview startup, make work remembering optional, render preview failures, and return preview users to the author app.
- Create `tests/editor-reader-preview-routing.test.mjs`: cover URL construction, route wiring, removal of the duplicate renderer, and editor build packaging.
- Create `tests/reader-editor-preview.test.mjs`: cover read-only startup, missing/corrupt failure states, and the complete phone-module character gate.

---

### Task 1: Replace the author preview renderer with a real-reader bridge

**Files:**
- Modify: `js/pages/reader.js`
- Modify: `js/app.js:184,301-303`
- Modify: `vite.config.ts:10-14`
- Test: `tests/editor-reader-preview-routing.test.mjs`

**Interfaces:**
- Produces: `buildReaderPreviewUrl(workId, baseHref): string`
- Produces: `redirectToReaderPreview(workId, locationObject): string`
- Consumes: the existing `/read/:id` hash-route parameter and the current document URL.

- [ ] **Step 1: Write the failing author-bridge test**

Create `tests/editor-reader-preview-routing.test.mjs` with the complete contract below. The conditional import keeps the RED failure an assertion instead of a missing-export module error while still placing the runtime assertions in the test before implementation.

```js
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const previewSource = readFileSync(new URL("../js/pages/reader.js", import.meta.url), "utf8")
const appSource = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")
const viteSource = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8")

test("author preview builds a same-origin encoded real-reader URL", async () => {
  const hasBridge = /export function buildReaderPreviewUrl/.test(previewSource)
  assert.equal(hasBridge, true)
  if (!hasBridge) return

  const bridge = await import(`../js/pages/reader.js?preview-route=${Date.now()}`)
  const target = bridge.buildReaderPreviewUrl(
    "work /?#中文",
    "https://example.test/tools/index.html#/read/work",
  )
  assert.equal(
    target,
    "https://example.test/tools/reader/index.html?preview=work+%2F%3F%23%E4%B8%AD%E6%96%87",
  )

  const replacements = []
  const locationObject = {
    href: "https://example.test/tools/index.html#/read/work",
    replace(value) { replacements.push(value) },
  }
  assert.equal(bridge.redirectToReaderPreview("work-1", locationObject), replacements[0])
  assert.equal(replacements.length, 1)
})

test("the author read route only redirects and the editor build ships the reader entry", () => {
  assert.match(appSource, /import\s*\{\s*redirectToReaderPreview\s*\}\s*from\s*["']\.\/pages\/reader\.js["']/)
  assert.match(appSource, /router\(["']\/read\/:id["'][\s\S]*redirectToReaderPreview\(p\.id\)/)
  assert.doesNotMatch(appSource, /renderHeader\(\)[^\n]*renderReader\(p\.id\)/)
  assert.match(viteSource, /reader\s*:\s*path\.resolve\(__dirname,\s*["']reader\/index\.html["']\)/)
})

test("the former author preview file contains no reader implementation or author-card projection", () => {
  assert.doesNotMatch(previewSource, /function renderArticleReader|function renderNode|pm-inline-card|phoneModules/)
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
node --test tests/editor-reader-preview-routing.test.mjs
```

Expected: three assertion failures because the bridge exports, route call, and reader build input do not exist, and the old preview implementation still exists.

- [ ] **Step 3: Replace `js/pages/reader.js` with the minimal bridge**

Replace the file contents with:

```js
export function buildReaderPreviewUrl(workId, baseHref = globalThis.location?.href) {
  if (!baseHref) throw new TypeError("A base URL is required to open reader preview")
  const target = new URL("reader/index.html", baseHref)
  target.hash = ""
  target.searchParams.set("preview", String(workId ?? ""))
  return target.href
}

export function redirectToReaderPreview(workId, locationObject = globalThis.location) {
  if (!locationObject || typeof locationObject.replace !== "function") {
    throw new TypeError("A replace-capable location is required to open reader preview")
  }
  const target = buildReaderPreviewUrl(workId, locationObject.href)
  locationObject.replace(target)
  return target
}
```

- [ ] **Step 4: Rewire the route and editor Vite input**

In `js/app.js`, replace the reader import and route with:

```js
import { redirectToReaderPreview } from "./pages/reader.js"

router("/read/:id", (container, p) => {
  redirectToReaderPreview(p.id)
})
```

In `vite.config.ts`, make the input map:

```ts
input: {
  main: path.resolve(__dirname, 'index.html'),
  reader: path.resolve(__dirname, 'reader/index.html'),
},
```

- [ ] **Step 5: Run the bridge test and verify GREEN**

Run:

```powershell
node --test tests/editor-reader-preview-routing.test.mjs tests/security-copy.test.mjs tests/build-verification.test.mjs
```

Expected: all tests pass; the password copy test reads the real reader source, and existing build-script contracts remain unchanged.

- [ ] **Step 6: Inspect the scoped diff without staging unrelated work**

Run:

```powershell
git diff --check -- js/pages/reader.js js/app.js vite.config.ts tests/editor-reader-preview-routing.test.mjs
git diff -- js/pages/reader.js js/app.js vite.config.ts tests/editor-reader-preview-routing.test.mjs
```

Expected: no whitespace errors; the old reader implementation is gone and no unrelated file is staged.

---

### Task 2: Add read-only editor-preview startup to the real reader

**Files:**
- Create: `reader/editor-preview.js`
- Modify: `reader/reader.js:1-12,174-180,297-312,675-695,3320-end`
- Test: `tests/reader-editor-preview.test.mjs`

**Interfaces:**
- Produces: `resolveEditorPreview(search, storage): { isPreview: false } | { isPreview: true, ok: true, work: object } | { isPreview: true, ok: false, code: string, message: string }`
- Produces: `buildEditorHomeUrl(baseHref): string`
- Consumes: `readLocalDatabase(storage)` from `js/storage.js` and `loadWork(work, { remember: false })` inside the real reader.

- [ ] **Step 1: Write the failing reader-preview integration test**

Create `tests/reader-editor-preview.test.mjs` with these imports and complete JSDOM setup. Setting `globalThis.location` is required because preview startup reads `location.search` directly.

```js
import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t, url) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}
```

Then define this article fixture and author-library seeder:

```js
function previewArticle(id = "preview-article") {
  return {
    schemaVersion: 1,
    id,
    type: "article",
    title: "Preview article",
    author: "Author",
    nodes: [{
      id: "start",
      title: "Start",
      content: '<p>Before</p><div class="pm-inline-card" data-pm-id="memo-module" data-pm-type="memo"><button data-a="pm-hamburger">Edit</button></div><p>After</p>',
      choices: [],
      scene: "",
      chapterId: "",
    }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [{
      id: "memo-module",
      type: "memo",
      nodeId: "start",
      data: {
        contacts: [
          { id: "contact-a", name: "Alice" },
          { id: "contact-b", name: "Bob" },
        ],
        memos: [
          { id: "memo-a", contactId: "contact-a", content: "Alice secret" },
          { id: "memo-b", contactId: "contact-b", content: "Bob secret" },
        ],
        appConnections: {
          memo: { contactId: "contact-b", prompt: "A signal from Bob's phone." },
        },
      },
    }],
    startNode: "start",
  }
}

function seedAuthorLibrary(works) {
  localStorage.setItem("tuuru_works", JSON.stringify({ works, contacts: [], groups: [] }))
}
```

Add three tests:

```js
test("editor preview uses the real reader gate without remembering the author work", async t => {
  installDom(t, "http://localhost/reader/?preview=preview-article")
  seedAuthorLibrary([previewArticle()])
  await import(`../reader/reader.js?editor-preview=${Date.now()}-${Math.random()}`)

  assert.ok(document.getElementById("rdStartBtn"))
  assert.equal(localStorage.getItem("moirain_work_preview-article"), null)
  assert.equal(localStorage.getItem("moirain_recent"), null)
  document.getElementById("rdStartBtn").click()

  assert.equal(document.querySelector(".pm-inline-card"), null)
  assert.equal(document.querySelector('[data-a="pm-hamburger"]'), null)
  const trigger = document.querySelector(".rd-pm-trigger")
  assert.ok(trigger)
  trigger.click()

  document.querySelector('[data-app-type="memo"]').click()
  const gate = document.querySelector(".rd-connection-gate")
  assert.ok(gate)
  assert.match(gate.textContent, /Bob/)
  assert.match(gate.textContent, /A signal from Bob's phone\./)
  assert.doesNotMatch(gate.textContent, /Alice secret|Bob secret/)

  gate.querySelector('[data-connection-action="confirm"]').click()
  assert.match(document.querySelector(".phone-frame").textContent, /Bob secret/)
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /Alice secret/)
  assert.equal(localStorage.getItem("moirain_work_preview-article"), null)
  assert.equal(localStorage.getItem("moirain_recent"), null)
})

test("editor preview fails closed when the requested work is absent", async t => {
  installDom(t, "http://localhost/reader/?preview=missing-work")
  seedAuthorLibrary([previewArticle("other-work")])
  await import(`../reader/reader.js?missing-preview=${Date.now()}-${Math.random()}`)

  const error = document.querySelector("[data-editor-preview-error]")
  assert.ok(error)
  assert.doesNotMatch(error.textContent, /Preview article/)
  assert.equal(document.querySelector(".rd-recent-item"), null)
})

test("editor preview fails closed when the author library is corrupt", async t => {
  installDom(t, "http://localhost/reader/?preview=preview-article")
  localStorage.setItem("tuuru_works", "{broken")
  await import(`../reader/reader.js?corrupt-preview=${Date.now()}-${Math.random()}`)

  assert.ok(document.querySelector("[data-editor-preview-error]"))
  assert.equal(document.querySelector(".rd-recent-item"), null)
})
```

- [ ] **Step 2: Run the reader-preview test and verify RED**

Run:

```powershell
node --test tests/reader-editor-preview.test.mjs
```

Expected: the first test cannot find `rdStartBtn`; missing and corrupt previews render the ordinary reader home instead of a fail-closed preview error.

- [ ] **Step 3: Implement the pure preview resolver**

Create `reader/editor-preview.js`:

```js
import { readLocalDatabase } from "../js/storage.js"

export function resolveEditorPreview(search, storage = globalThis.localStorage) {
  const params = new URLSearchParams(String(search || ""))
  if (!params.has("preview")) return { isPreview: false }

  const workId = String(params.get("preview") || "").trim()
  if (!workId) {
    return { isPreview: true, ok: false, code: "missing-preview-id", message: "预览链接缺少作品编号。" }
  }

  try {
    const database = readLocalDatabase(storage)
    const matches = database.works.filter(work => String(work.id) === workId)
    if (matches.length !== 1) {
      return { isPreview: true, ok: false, code: "preview-work-not-found", message: "找不到要预览的作品，请返回创作端重试。" }
    }
    return { isPreview: true, ok: true, work: matches[0] }
  } catch (error) {
    return { isPreview: true, ok: false, code: "preview-library-unavailable", message: "本地创作库暂时无法读取，请返回创作端检查数据。" }
  }
}

export function buildEditorHomeUrl(baseHref = globalThis.location?.href) {
  if (!baseHref) throw new TypeError("A base URL is required to return to the editor")
  return new URL("../index.html", baseHref).href
}
```

- [ ] **Step 4: Make real-reader startup preview-aware and remembering optional**

At the top of `reader/reader.js`, import:

```js
import { buildEditorHomeUrl, resolveEditorPreview } from "./editor-preview.js"
```

Add reader state beside `_work`:

```js
var _editorPreviewMode = false
var _editorHomeUrl = ""
```

Change `loadWork` to accept an option and guard only the work/recent cache writes:

```js
function loadWork(work, options) {
  if (!work.type) { alert("无效的作品文件"); return }
  _work = work
  resetReaderPhoneChoiceSession(work)
  _nodeId = null
  _visitedNodes = []
  var remember = !options || options.remember !== false
  if (remember) {
    var cached = tryReaderStorageWrite(function() {
      localStorage.setItem("moirain_work_" + work.id, JSON.stringify(work))
    })
    if (cached) tryReaderStorageWrite(function() { addRecent(work) })
  }
  showLandingPage(work, function() {
    if (_work.type === "phone") renderPhoneReader()
    else renderArticleReader()
  })
}
```

Replace the final unconditional `renderHome()` with:

```js
function renderEditorPreviewError(message) {
  render("app", '<div class="drop-zone" data-editor-preview-error><p>' + esc(message) + '</p><button type="button" class="drop-btn" data-reader-home>返回创作端</button></div>')
}

function startReader() {
  var preview = resolveEditorPreview(location.search)
  if (!preview.isPreview) {
    renderHome()
    return
  }

  _editorPreviewMode = true
  _editorHomeUrl = buildEditorHomeUrl(location.href)
  if (!preview.ok) {
    renderEditorPreviewError(preview.message)
    return
  }
  loadWork(preview.work, { remember: false })
}

startReader()
```

In the existing delegated `[data-reader-home]` handler, branch before `renderHome()`:

```js
if (_editorPreviewMode) {
  location.assign(_editorHomeUrl)
  return
}
renderHome()
```

- [ ] **Step 5: Run focused reader tests and verify GREEN**

Run:

```powershell
node --test tests/reader-editor-preview.test.mjs tests/reader-phone-module-trigger.test.mjs tests/reader-contact-context.test.mjs tests/reader-phone-gallery.test.mjs tests/reader-article-dangling-choice.test.mjs tests/security-copy.test.mjs
```

Expected: all tests pass; the preview interaction reaches the authored Bob connection gate and content while cache keys remain absent.

- [ ] **Step 6: Verify ordinary reader startup remains unchanged**

Run:

```powershell
node --test tests/reader-home-navigation.test.mjs tests/reader-import-resilience.test.mjs tests/reader-phone-call.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-social-choice-runtime.test.mjs
```

Expected: all tests pass; opening `/reader/` without `preview` still renders the reader home and imported/recent works still use normal remembering behavior.

- [ ] **Step 7: Inspect the scoped diff without staging unrelated work**

Run:

```powershell
git diff --check -- reader/editor-preview.js reader/reader.js tests/reader-editor-preview.test.mjs
git diff -- reader/editor-preview.js reader/reader.js tests/reader-editor-preview.test.mjs
```

Expected: no whitespace errors, no author-library writes in preview mode, and no duplicated article or phone renderer.

---

### Task 3: Full verification, production packaging, and interactive acceptance

**Files:**
- Verify: all Task 1 and Task 2 files
- Test: complete `tests/` suite and both Vite build entries

**Interfaces:**
- Consumes: `redirectToReaderPreview`, `resolveEditorPreview`, preview-aware `loadWork`, and the existing real reader runtime.
- Produces: verified editor and reader builds with one reader behavior path.

- [ ] **Step 1: Run the complete automated test suite**

Run:

```powershell
npm test
```

Expected: exit code 0 with zero failed, cancelled, or skipped-by-error tests.

- [ ] **Step 2: Run TypeScript and both temporary Vite production builds**

Run:

```powershell
npm run build:verify
```

Expected: exit code 0; the editor build emits `reader/index.html`, the independent reader build succeeds, and the temporary output is cleaned.

- [ ] **Step 3: Start the local author app and seed or use an existing article fixture**

Run the existing `npm run dev -- --host 127.0.0.1` script in a hidden background process. In the local app, use an article containing a locked memo/gallery/browser/shopping phone module, or seed the exact fixture from Task 2 into `tuuru_works` through the app's normal local data path.

Expected: the author app is reachable on port 8765 and the work list shows the article.

- [ ] **Step 4: Exercise the real browser flow**

Verify in the browser:

1. Click “阅读” from the author work list.
2. Confirm the URL becomes `/reader/index.html?preview=<encoded-id>` and the author header disappears.
3. Start reading and confirm the article contains `.rd-pm-trigger` but no `.pm-inline-card`, author hamburger, edit, or delete control.
4. Open the phone module and the locked App.
5. Confirm the character/prompt gate appears before content.
6. Cancel and verify no content appears; reopen, confirm, and verify only the bound character's content appears.
7. Return to the author app and verify the work body and `updatedAt` are unchanged.
8. Refresh preview and verify no `moirain_work_<id>` or `moirain_recent` entry is created.

- [ ] **Step 5: Request independent code review**

Dispatch a focused reviewer with the design spec, implementation plan, and scoped diff. Require checks for duplicate reader behavior, local-storage writes, exact-ID failure behavior, build-path correctness, XSS/URL safety, ordinary-reader regressions, and accidental inclusion of unrelated dirty work.

Expected: no Critical or Important issue remains unresolved.

- [ ] **Step 6: Run fresh final verification after review fixes**

Run:

```powershell
node --test tests/editor-reader-preview-routing.test.mjs tests/reader-editor-preview.test.mjs tests/reader-phone-module-trigger.test.mjs tests/reader-contact-context.test.mjs
npm test
npm run build:verify
git diff --check
git status --short
```

Expected: every test/build command exits 0; `git diff --check` is clean; `git status --short` shows only the pre-existing worktree changes plus the scoped preview-parity files, with no generated build output.
