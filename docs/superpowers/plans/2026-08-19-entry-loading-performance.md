# Author/Reader Entry Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce author/reader entry loading and switching cost without changing routes, saved data, rendering output, or feature behavior.

**Architecture:** Keep the existing two-entry application and hash router. Split author page modules at route boundaries, and defer optional camera/export libraries until the user invokes those features; normal navigation keeps the same functions and parameters.

**Tech Stack:** Browser ES modules, Vite 6, Node test runner, jsdom.

## Global Constraints

- Do not change user-visible features, routes, labels, saved-data formats, or editor/reader behavior.
- Do not add dependencies.
- Preserve the existing author/reader return URL behavior and camera/export fallbacks.
- Measure production build output before and after the change.

---

### Task 1: Add lazy-loading regression contracts

**Files:**
- Create: `tests/entry-loading-performance.test.mjs`

**Interfaces:**
- Consumes: source files `js/app.js`, `js/interactive-scene-camera.js`, and `reader/reader.js`.
- Produces: regression checks that optional page and media libraries are not eager entry imports.

- [x] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = path => readFile(new URL(path, import.meta.url), "utf8")

test("author pages load at route boundaries", async () => {
  const app = await source("../js/app.js")
  assert.doesNotMatch(app, /from ["']\.\/pages\/(?:home|new|editor|phone|resources|exports)\.js["']/)
  for (const page of ["home", "new", "editor", "phone", "resources", "exports"]) {
    assert.match(app, new RegExp(`import\\(["']\\.\\/pages\\/${page}\\.js["']\\)`))
  }
})

test("optional reader media libraries load only when invoked", async () => {
  const [camera, reader] = await Promise.all([
    source("../js/interactive-scene-camera.js"),
    source("../reader/reader.js"),
  ])
  assert.doesNotMatch(camera, /from ["']@mediapipe\/tasks-vision["']/)
  assert.match(camera, /import\(["']@mediapipe\/tasks-vision["']\)/)
  assert.doesNotMatch(reader, /from ["']\.\/phone-content-export\.js["']/)
  assert.match(reader, /import\(["']\.\/phone-content-export\.js["']\)/)
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/entry-loading-performance.test.mjs`

Expected: FAIL because all three paths are currently eager imports.

### Task 2: Split author page modules by route

**Files:**
- Modify: `js/app.js`
- Test: `tests/entry-loading-performance.test.mjs`

**Interfaces:**
- Consumes: the router's existing support for awaiting async route callbacks.
- Produces: route callbacks that dynamically import the same page exports before rendering and binding.

- [x] **Step 1: Replace eager page imports with route-local imports**

```js
router("/", async () => {
  const { bindHome, renderHome } = await import("./pages/home.js")
  app.innerHTML = renderHeader() + '<main class="app-main">' + renderHome() + '</main>'
  bindHome()
})
```

Apply the same pattern to `/new`, both resources routes, `/exports`, `/edit/:id`, and `/phone/:id`. Keep `./pages/reader.js` eager because `renderHeader()` needs `buildReaderPreviewUrl` synchronously.

- [x] **Step 2: Run the entry contract**

Run: `node --test tests/entry-loading-performance.test.mjs tests/app-entry-links.test.mjs tests/router.test.mjs`

Expected: the author route-loading contract and routing tests PASS; the optional media-loading contract still FAILS.

### Task 3: Defer optional reader media libraries

**Files:**
- Modify: `js/interactive-scene-camera.js`
- Modify: `reader/reader.js`
- Test: `tests/entry-loading-performance.test.mjs`
- Test: `tests/interactive-scene-camera.test.mjs`
- Test: `tests/reader-phone-content-export.test.mjs`

**Interfaces:**
- Consumes: `import("@mediapipe/tasks-vision")` and `import("./phone-content-export.js")` promises.
- Produces: the same `FaceDetector`, `FilesetResolver`, screenshot, filename, masking, and ZIP functions at invocation time.

- [x] **Step 1: Lazy-load the MediaPipe fallback**

```js
let mediaPipeTasksPromise = null

async function loadMediaPipeTasks() {
  if (!mediaPipeTasksPromise) mediaPipeTasksPromise = import("@mediapipe/tasks-vision")
  try {
    return await mediaPipeTasksPromise
  } catch (error) {
    mediaPipeTasksPromise = null
    throw error
  }
}
```

Resolve `FaceDetector` and `FilesetResolver` inside `createMediaPipeFaceDetector()` so native `FaceDetector` and non-camera readers never parse MediaPipe.

- [x] **Step 2: Lazy-load screenshot and ZIP helpers**

```js
let phoneContentExportPromise = null

async function loadPhoneContentExport() {
  if (!phoneContentExportPromise) phoneContentExportPromise = import("./phone-content-export.js")
  try {
    return await phoneContentExportPromise
  } catch (error) {
    phoneContentExportPromise = null
    throw error
  }
}
```

Load and destructure these helpers at the beginning of `exportReaderPhoneContentImages()` and pass the filename helpers into `readerPhoneExportUniqueBaseName()`.

- [x] **Step 3: Run targeted behavior and loading tests**

Run: `node --test tests/entry-loading-performance.test.mjs tests/interactive-scene-camera.test.mjs tests/reader-phone-content-export.test.mjs tests/phone-content-export.test.mjs`

Expected: PASS with unchanged camera and image-export behavior.

### Task 4: Reuse immutable production assets across mode switches

**Files:**
- Modify: `public/_headers`
- Modify: `public/sw.js`
- Modify: `tests/pwa-twa.test.mjs`

**Interfaces:**
- Consumes: Vite's hashed `/assets/*` filenames.
- Produces: long-lived HTTP caching and service-worker cache-first delivery only for versioned production assets; HTML and unhashed development modules remain network-first.

- [x] **Step 1: Write the failing cache-policy assertions**

```js
assert.match(worker, /url\.pathname\.startsWith\(["']\/assets\/["']\)/)
assert.match(worker, /cachedAsset\(request\)/)
assert.match(headers, /\/assets\/\*\s*\n\s+Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i)
```

- [x] **Step 2: Scope cache-first behavior to production assets**

```js
if (request.destination === "style" || request.destination === "script") {
  event.respondWith(
    url.pathname.startsWith("/assets/")
      ? cachedAsset(request)
      : networkFirstAsset(request),
  )
  return
}
```

Keep navigation requests network-first, retain network-first handling for unhashed source modules, and bump the worker cache version so the policy activates cleanly.

- [x] **Step 3: Give hashed assets an immutable HTTP policy**

Set `/assets/*` to `Cache-Control: public, max-age=31536000, immutable`; leave HTML, the service worker, and the manifest unchanged.

- [x] **Step 4: Run the PWA contract**

Run: `node --test tests/pwa-twa.test.mjs`

Expected: PASS while still asserting network-first navigation and live service-worker updates.

### Task 5: Render only the active reader-home tab

**Files:**
- Modify: `reader/reader.js`
- Create: `tests/reader-home-lazy-tabs.test.mjs`

**Interfaces:**
- Consumes: existing `refreshPersonalPage()`, `refreshBookshelfPage()`, and `renderCustomPage()` activation functions.
- Produces: the same three reader-home panels, with inactive panel contents created on first activation instead of initial page load.

- [x] **Step 1: Write the failing runtime test**

Create a fresh jsdom reader homepage with one cached book. Before clicking a tab, assert that the default personal panel has content while `#tabLibrary` and `#tabCustom` are empty and the page does not contain the text `undefined`. Click `data-tab="library"` and assert `.rd-bookshelf` appears; click `data-tab="custom"` and assert `.rd-custom` appears.

- [x] **Step 2: Render only the active panel initially**

```js
h += '<div ... id="tabPersonal" ...>' + (activeTab === 'personal' ? renderPersonalPage() : '') + '</div>'
h += '<div ... id="tabLibrary" ...>' + (activeTab === 'library' ? renderBookshelfPage() : '') + '</div>'
h += '<div ... id="tabCustom" ...></div>'
```

After mounting, bind only the content that exists and call `renderCustomPage()` once when custom is the active initial tab. Keep existing tab activation, focus, ARIA, and restore logic unchanged.

- [x] **Step 3: Run reader-home tests**

Run: `node --test tests/reader-home-lazy-tabs.test.mjs tests/reader-bookshelf-ui.test.mjs tests/reader-home-navigation.test.mjs`

Expected: PASS with the bookshelf and customizer appearing on their first click.

### Task 6: Verify behavior and quantify the result

**Files:**
- Verify: production output in `dist/assets/`

**Interfaces:**
- Consumes: all changes from Tasks 1-5.
- Produces: passing repository verification plus before/after entry bundle measurements.

- [x] **Step 1: Run the full verification suite**

Run: `npm run verify`

Expected: all Node tests and both production entry builds PASS.

- [x] **Step 2: Build and record entry sizes**

Run: `npm run build`

Expected: Vite emits separate author page, MediaPipe, and phone-export chunks; the initial `main` and `reader` entry chunks are smaller than the baseline `929.94 kB` and `686.09 kB` raw respectively.

- [x] **Step 3: Re-test visible navigation**

Open the production preview and switch author → reader → author, then verify the same destination URL, header, library contents, and return route appear with no console errors.

### Follow-up hardening completed during final review

- [x] Keep the export-center direct route functional by loading its existing home export actions before binding the page.
- [x] Inject every emitted production JS/CSS asset into the service-worker precache manifest so unvisited lazy routes remain available offline.
- [x] Derive the service-worker cache version from the emitted asset manifest, retain the two previous builds, and avoid taking over already-open tabs during an update.
- [x] Update cached-work reader tests to follow the visible user path: open the bookshelf, then open the work.
