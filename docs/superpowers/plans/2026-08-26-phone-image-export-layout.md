# Phone Image Export Layout Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exported phone-content PNGs preserve real message/card geometry so transfer cards and every other supported message surface neither overlap nor create incorrect page breaks.

**Architecture:** Keep the reader's `content-visibility:auto` optimization for the live UI, but normalize only the cloned export tree before measurement and rasterization. The export boundary will eagerly lay out every optimized surface, exclude ignored controls from measurement, eagerly settle cloned images, and treat every direct chat timeline row as a page-break candidate.

**Tech Stack:** Browser DOM/CSS, JavaScript ES modules, `html-to-image`, JSDOM, Node.js test runner, Chromium/Edge visual acceptance testing.

## Global Constraints

- Do not remove or weaken `content-visibility:auto` from the normal reader UI.
- Preserve the existing export dimensions: `360` CSS pixels wide, at most `1600` CSS pixels per page, and pixel ratio `2` by default.
- Apply layout overrides only to the disposable export clone; never mutate the live reader panel.
- Cover all 20 renderer message types through their shared `.rd-chat-message` row and cover direct `.rd-chat-time`, `.rd-chat-system`, `.rd-call-card`, and `.rd-chat-story-event` rows.
- Cover optimized non-chat surfaces: `.rd-post-card`, `.rd-memo-note`, `.rd-gallery-photo`, and `.rd-browser-entry`.
- Add no runtime dependency and leave the user's unrelated untracked files untouched.
- Do not commit, push, or deploy this change unless the user asks after reviewing it.

---

### Task 1: Normalize the export clone before measuring it

**Files:**
- Modify: `reader/phone-content-export.js:7-16,187-229`
- Test: `tests/phone-content-export.test.mjs:94-119`

**Interfaces:**
- Consumes: `capturePhonePanelPages(sourcePanel, options)` and its existing `rasterize(viewport, options)` test seam.
- Produces: an internal export-tree preparation contract in which optimized rows have `content-visibility:visible` and `contain-intrinsic-size:none`, ignored controls have `display:none`, and cloned images request eager loading before measurement.

- [ ] **Step 1: Write the failing export-tree layout regression test**

Add this test after the existing staging-tree cleanup test:

```js
test("capture eagerly lays out every optimized export surface and removes ignored controls from measurement", async () => {
  const messageTypes = [
    "text", "image", "voice", "link", "redpacket", "transfer", "familycard",
    "takeaway", "location", "contact-card", "file", "music", "forward", "schedule",
    "time", "system", "call", "system-event", "contact-event", "unknown",
  ]
  const rows = messageTypes
    .map(type => `<article class="rd-chat-message chat-msg" data-message-type="${type}">${type}</article>`)
    .join("")
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel"><div class="rd-phone-app-body">${rows}<article class="rd-post-card">post</article><article class="rd-memo-note">memo</article><article class="rd-gallery-photo">photo</article><article class="rd-browser-entry">browser</article><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" loading="lazy" decoding="async"><footer class="chat-composer">composer</footer></div></section></div></body>`)
  const panel = dom.window.document.querySelector(".rd-phone-app-panel")
  let inspected = false

  await capturePhonePanelPages(panel, {
    rasterize:async viewport => {
      inspected = true
      for (const node of viewport.querySelectorAll(".rd-chat-message, .rd-post-card, .rd-memo-note, .rd-gallery-photo, .rd-browser-entry")) {
        assert.equal(node.style.getPropertyValue("content-visibility"), "visible")
        assert.equal(node.style.getPropertyPriority("content-visibility"), "important")
        assert.equal(node.style.getPropertyValue("contain-intrinsic-size"), "none")
      }
      assert.equal(viewport.querySelector(".chat-composer").style.getPropertyValue("display"), "none")
      assert.equal(viewport.querySelector("img").getAttribute("loading"), "eager")
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })

  assert.equal(inspected, true)
  assert.equal(panel.querySelector(".chat-composer").style.display, "")
  assert.equal(panel.querySelector("img").getAttribute("loading"), "lazy")
})
```

- [ ] **Step 2: Run the focused test and confirm the current implementation is red**

Run: `node --test --test-name-pattern="eagerly lays out" tests/phone-content-export.test.mjs`

Expected: FAIL because the cloned `.rd-chat-message` rows still have no inline `content-visibility:visible` override.

- [ ] **Step 3: Add export-only eager-layout and ignored-control preparation**

Define selector constants next to `PHONE_EXPORT_BREAK_SELECTORS` and extend `forceExportLayout`:

```js
const PHONE_EXPORT_EAGER_LAYOUT_SELECTORS = [
  ".rd-chat-message",
  ".rd-chat-time",
  ".rd-post-card",
  ".rd-memo-note",
  ".rd-gallery-photo",
  ".rd-browser-entry",
].join(",")

const PHONE_EXPORT_IGNORED_SELECTORS = [
  ".chat-composer",
  ".rd-thread-choice-controls",
  ".rd-thread-choice-reselect",
].join(",")

for (const element of panel.querySelectorAll(PHONE_EXPORT_EAGER_LAYOUT_SELECTORS)) {
  element.style.setProperty("content-visibility", "visible", "important")
  element.style.setProperty("contain-intrinsic-size", "none", "important")
}
for (const element of panel.querySelectorAll(PHONE_EXPORT_IGNORED_SELECTORS)) {
  element.dataset.phoneExportIgnore = "true"
  element.style.setProperty("display", "none", "important")
}
for (const image of panel.querySelectorAll("img")) {
  image.setAttribute("loading", "eager")
  image.setAttribute("decoding", "sync")
}
```

- [ ] **Step 4: Wait for successful cloned-image decoding without blocking broken images**

Replace each image wait with a load/error/timeout wait followed by a guarded decode:

```js
const pending = [...root.querySelectorAll("img")].map(async image => {
  image.setAttribute("loading", "eager")
  if (!image.complete) {
    await new Promise(resolve => {
      const finish = () => resolve()
      image.addEventListener("load", finish, { once:true })
      image.addEventListener("error", finish, { once:true })
      setTimeout(finish, 2500)
    })
  }
  if (typeof image.decode === "function" && image.complete && image.naturalWidth > 0) {
    await image.decode().catch(() => undefined)
  }
})
```

- [ ] **Step 5: Run focused and neighboring export tests**

Run: `node --test tests/phone-content-export.test.mjs tests/reader-phone-content-export.test.mjs`

Expected: all tests PASS; the source panel assertions prove clone-only mutation.

### Task 2: Make pagination aware of every direct chat timeline row

**Files:**
- Modify: `reader/phone-content-export.js:13-27`
- Test: `tests/phone-content-export.test.mjs:83-119`

**Interfaces:**
- Consumes: `exportBreakpoints(panel)` and `phoneExportPageWindows(totalHeight, maximumHeight, breakpoints)`.
- Produces: page windows whose boundaries can use the bottoms of chat messages, time rows, system rows, call rows, and story-event rows.

- [ ] **Step 1: Write the failing direct-row pagination test**

Add a geometry stub and test that infer the internal breakpoints through `onPage`:

```js
test("capture uses every direct chat timeline row as a page-break candidate", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel" data-top="0" data-height="2100"><div class="rd-phone-app-body"><div class="rd-chat-time" data-top="0" data-height="400">time</div><div class="rd-chat-system" data-top="400" data-height="400">system</div><div class="rd-call-card" data-top="800" data-height="300">call</div><div class="rd-chat-story-event" data-top="1100" data-height="800">event</div></div></section></div></body>`)
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = Number(this.dataset.top || 0)
    const height = Number(this.dataset.height || 0)
    return { top, bottom:top + height, left:0, right:360, width:360, height, x:0, y:top, toJSON(){} }
  }
  const pages = []

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    maximumPageHeight:1200,
    onPage:page => pages.push({ top:page.top, height:page.height }),
    rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
  })

  assert.deepEqual(pages, [
    { top:0, height:1100 },
    { top:1100, height:1000 },
  ])
})
```

- [ ] **Step 2: Run the pagination test and confirm it is red**

Run: `node --test --test-name-pattern="direct chat timeline" tests/phone-content-export.test.mjs`

Expected: FAIL with page windows `[{ top:0, height:1200 }, { top:1200, height:900 }]` because the four actual direct-row classes are absent from the selector list.

- [ ] **Step 3: Add the real direct-row classes to `PHONE_EXPORT_BREAK_SELECTORS`**

Keep existing surface selectors and add:

```js
  ".rd-chat-message",
  ".rd-chat-time",
  ".rd-chat-system",
  ".rd-call-card",
  ".rd-chat-story-event",
```

The existing `.chat-msg` remains for compatibility with older rendered markup.

- [ ] **Step 4: Run all export-focused tests**

Run: `node --test tests/phone-content-export.test.mjs tests/reader-phone-content-export.test.mjs tests/reader-phone-story-events.test.mjs tests/showcase-phone.test.mjs`

Expected: all tests PASS with no changed live-reader DOM or export state.

### Task 3: Verify real-browser geometry and project health

**Files:**
- Verify: `reader/phone-content-export.js`
- Verify: `tests/phone-content-export.test.mjs`

**Interfaces:**
- Consumes: the local Vite reader, full-chain phone showcase work, and the export dialog.
- Produces: browser evidence that export-stage rows contain their cards and adjacent rows do not overlap, plus repository-wide verification evidence.

- [ ] **Step 1: Run the local reader and import the full-chain showcase**

Run: `npx vite --config vite.config.ts --host=127.0.0.1 --port=4179 --strictPort`

Open `http://localhost:4179/reader/index.html`, import `samples/showcase/tuuru-phone-full-chain-showcase.json`, start reading, return to the reader home, open `美化`, and choose `图片导出`.

- [ ] **Step 2: Exercise export and inspect the live export stage**

During `导出全部内容`, collect `.rd-phone-export-stage .rd-chat-message` rectangles and each row's descendant-card rectangle. For every adjacent pair assert `next.top >= previous.bottom - 0.5`; for every row assert `row.bottom >= max(descendant.bottom) - 0.5`. Specifically confirm `transfer`, `redpacket`, `familycard`, and `takeaway` rows have heights greater than `72px` when their cards require it.

- [ ] **Step 3: Run repository verification**

Run: `npm run verify`

Expected: the complete Node test suite, TypeScript build, and build verification all PASS.

- [ ] **Step 4: Check the final diff and workspace preservation**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only `reader/phone-content-export.js`, `tests/phone-content-export.test.mjs`, this plan, and the user's pre-existing untracked paths appear; no unrelated file is modified.
