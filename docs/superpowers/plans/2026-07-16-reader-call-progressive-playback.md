# Reader Call Progressive Playback and Background Beautification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reveal reader-side call dialogue one line per explicit activation and let readers choose a safe, reader-local background shared by all voice and video calls.

**Architecture:** A new immutable, DOM-free playback model normalizes authored call dialogue and advances one index at a time. `openReaderChat()` owns a fresh model instance for each call opening and renders only revealed lines. Existing Messages beautification settings gain defensively normalized preset/image fields; the modal edits a private draft, validates local raster uploads before preview, and persists one candidate through the existing guarded save path.

**Tech Stack:** Vanilla JavaScript ES modules, CSS custom properties, browser `FileReader`/`Image`, Node.js `node:test`, JSDOM 27, Vite 6.

## Global Constraints

- Implement only progressive call playback and reader-owned call-background beautification. Do not mix in forum posting, freeform reader replies, Reading Flow sorting, or character name/avatar overrides.
- Preserve the author work schema, import/export payloads, recent-reading records, editor preview payloads, and all author-controlled caller names/avatars.
- Playback must perform no local-storage write. Only an explicit successful Messages beautification save may update `moirain_phoneCustom`.
- Voice and video calls share one global reader-local background across all works.
- The new call-background control accepts built-in presets or local PNG/JPEG/WebP only. It exposes no external URL field and rejects GIF, SVG, animated WebP, malformed data URLs, failed decodes, zero-dimension images, and files larger than 2 MiB.
- Future call lines must not appear anywhere in the DOM, hidden attributes, or serialized markup before advancement.
- Use a native button for advancement. Do not add `keydown` handlers for Enter/Space; native button semantics prevent double advancement in real browsers.
- Remove dotted/radial texture only from `.rd-call-scene`. The existing phone desktop wallpaper pattern is outside this task.
- Keep `openedCallScenes` and `mayAutoOpenCall` behavior intact so hanging up never auto-opens the next call.
- Preserve the exact prior stored value on Cancel, upload validation failure, and storage failure.
- Work in the current `codex/phone-runtime-overhaul` checkout because the required reader overhaul exists only in this dirty worktree. Do not create a detached worktree that omits those dependencies.
- Do not stage or commit implementation files. Review scoped diffs in place and preserve all pre-existing dirty changes, including the unrelated untracked `.superpowers/` directory.

## File Structure

- Create `reader/call-playback.js`: immutable dialogue normalization and advancement.
- Modify `reader/reader.js`: call rendering, background normalization/presentation, Messages draft controls, and local-image validation.
- Modify `reader/reader.css`: rolling transcript, safe background presets/overlay, modal controls, focus, touch, contrast, and reduced motion.
- Create `tests/reader-call-playback.test.mjs`: pure model contract.
- Modify `tests/reader-phone-call.test.mjs`: DOM secrecy, advancement, completion, replay, focus, legacy, empty, and multi-call behavior.
- Modify `tests/reader-app-settings-dialog.test.mjs`: preset draft, normalization, upload, reset, Cancel, and failure recovery.
- Modify `tests/reader-phone-accessibility.test.mjs`: native controls, call-only no-dot rule, target size, focus, and reduced motion.
- Modify `tests/default-color-contrast.test.mjs`: call preset, overlay, transcript, and semantic-text contrast contracts.

---

### Task 1: Build the immutable call playback model

**Files:**
- Create: `reader/call-playback.js`
- Create: `tests/reader-call-playback.test.mjs`

**Interfaces:**
- Produces: `createCallPlaybackState(callLines, fallbackText): Readonly<CallPlaybackState>`
- Produces: `advanceCallPlayback(state): Readonly<CallPlaybackState>`
- State: `{ lines: readonly string[], currentIndex: number, isEmpty: boolean, isComplete: boolean }`

- [ ] **Step 1: Write the failing pure-model tests**

Create `tests/reader-call-playback.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import {
  advanceCallPlayback,
  createCallPlaybackState,
} from "../reader/call-playback.js"

test("normalizes string lines without mutating inputs", () => {
  const input = ["  第一行  ", "", "   ", "第二行"]
  const snapshot = input.slice()
  const state = createCallPlaybackState(input, "备用台词")

  assert.deepEqual(state.lines, ["第一行", "第二行"])
  assert.deepEqual(input, snapshot)
  assert.equal(Object.isFrozen(state), true)
  assert.equal(Object.isFrozen(state.lines), true)
})

test("uses fallback text only when no valid call line remains", () => {
  assert.deepEqual(
    createCallPlaybackState([null, "  ", 42], "  旧格式台词  ").lines,
    ["旧格式台词"],
  )
  assert.deepEqual(
    createCallPlaybackState(["新格式台词"], "旧格式台词").lines,
    ["新格式台词"],
  )
})

test("represents an empty call as complete at index minus one", () => {
  const state = createCallPlaybackState([null, "  "], " ")
  assert.deepEqual(state, {
    lines: [],
    currentIndex: -1,
    isEmpty: true,
    isComplete: true,
  })
})

test("starts a non-empty call at its first line", () => {
  const state = createCallPlaybackState(["一", "二", "三"])
  assert.equal(state.currentIndex, 0)
  assert.equal(state.isEmpty, false)
  assert.equal(state.isComplete, false)
  assert.equal(state.lines[state.currentIndex], "一")
})

test("reveals exactly one line per advance without changing prior states", () => {
  const first = createCallPlaybackState(["一", "二", "三"])
  const second = advanceCallPlayback(first)
  const third = advanceCallPlayback(second)

  assert.equal(first.currentIndex, 0)
  assert.equal(second.currentIndex, 1)
  assert.equal(third.currentIndex, 2)
  assert.equal(first.isComplete, false)
  assert.equal(second.isComplete, false)
  assert.equal(third.isComplete, true)
  assert.strictEqual(first.lines, second.lines)
  assert.strictEqual(second.lines, third.lines)
  assert.equal(Object.isFrozen(second), true)
})

test("returns the identical state after completion", () => {
  const complete = createCallPlaybackState(["只有一句"])
  assert.strictEqual(advanceCallPlayback(complete), complete)
})

test("creates independent fresh state for every reopen", () => {
  const lines = ["一", "二"]
  const firstOpening = advanceCallPlayback(createCallPlaybackState(lines))
  const secondOpening = createCallPlaybackState(lines)

  assert.equal(firstOpening.currentIndex, 1)
  assert.equal(secondOpening.currentIndex, 0)
  assert.notStrictEqual(firstOpening, secondOpening)
})

test("skips hostile values and accessor entries without coercion", () => {
  let getterRuns = 0
  let coercions = 0
  const lines = []
  Object.defineProperty(lines, "0", {
    configurable: true,
    get() {
      getterRuns += 1
      return "泄漏台词"
    },
  })
  lines.length = 1
  lines.push({
    toString() {
      coercions += 1
      return "对象台词"
    },
  })

  const state = createCallPlaybackState(lines, "安全备用")
  assert.deepEqual(state.lines, ["安全备用"])
  assert.equal(getterRuns, 0)
  assert.equal(coercions, 0)
})
```

- [ ] **Step 2: Run the model test and verify RED**

Run:

```powershell
node --test tests/reader-call-playback.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for `reader/call-playback.js`.

- [ ] **Step 3: Implement the minimal immutable model**

Create `reader/call-playback.js`:

```js
function normalizeCallLines(callLines, fallbackText) {
  const result = []

  if (Array.isArray(callLines)) {
    for (let index = 0; index < callLines.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(callLines, String(index))
      if (!descriptor || !("value" in descriptor)) continue
      const value = descriptor.value
      if (typeof value !== "string") continue
      const line = value.trim()
      if (line) result.push(line)
    }
  }

  if (result.length === 0 && typeof fallbackText === "string") {
    const fallback = fallbackText.trim()
    if (fallback) result.push(fallback)
  }

  return Object.freeze(result)
}

function createState(lines, currentIndex) {
  const isEmpty = lines.length === 0
  return Object.freeze({
    lines,
    currentIndex: isEmpty ? -1 : currentIndex,
    isEmpty,
    isComplete: isEmpty || currentIndex === lines.length - 1,
  })
}

export function createCallPlaybackState(callLines, fallbackText) {
  return createState(normalizeCallLines(callLines, fallbackText), 0)
}

export function advanceCallPlayback(state) {
  if (state.isComplete) return state
  return createState(state.lines, state.currentIndex + 1)
}
```

- [ ] **Step 4: Run the model test and verify GREEN**

Run:

```powershell
node --test tests/reader-call-playback.test.mjs
```

Expected: 8 tests pass with no failures.

- [ ] **Step 5: Review the scoped model diff without staging it**

Run:

```powershell
git diff --check -- reader/call-playback.js tests/reader-call-playback.test.mjs
git diff -- reader/call-playback.js tests/reader-call-playback.test.mjs
```

Expected: no whitespace errors; the module imports no DOM, storage, timer, or authored-work helper.

---

### Task 2: Integrate one-line-at-a-time playback into the real reader

**Files:**
- Modify: `reader/reader.js:1-12,1840-1930`
- Modify: `tests/reader-phone-call.test.mjs`

**Interfaces:**
- Consumes: `createCallPlaybackState()` and `advanceCallPlayback()`.
- Preserves: `openedCallScenes`, `mayAutoOpenCall`, call-key routing, voice/video labels, caller lookup, and `renderChat()`.
- Produces stable hooks: `.rd-call-advance`, `.rd-call-line.old`, `.rd-call-line.current`, `.rd-call-progress`, `.rd-call-complete`, `.rd-call-empty`, `.rd-call-hangup`.

- [ ] **Step 1: Rewrite the eager-render test and add progression/focus regressions**

In `tests/reader-phone-call.test.mjs`, add this helper after `callPhoneWork()`:

```js
async function openFirstCall(moduleKey) {
  await import(`../reader/reader.js?${moduleKey}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  return document.querySelector(".rd-call-scene")
}

function snapshotLocalStorage() {
  const entries = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    entries.push([key, localStorage.getItem(key)])
  }
  return entries.sort(([left], [right]) => left.localeCompare(right))
}
```

Replace the current first call test and add these tests while retaining the caller-attribute and mixed-chat regressions:

```js
test("reader call initially mounts only the first line and focuses a native advance button", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["第一句", "第二句", "第三句"],
  }] }))

  const scene = await openFirstCall("reader-call-first-line")
  assert.ok(scene)
  assert.match(scene.textContent, /第一句/)
  assert.doesNotMatch(scene.textContent, /第二句|第三句/)
  const advance = scene.querySelector(".rd-call-advance")
  assert.equal(advance.tagName, "BUTTON")
  assert.equal(advance.type, "button")
  assert.match(advance.getAttribute("aria-label"), /下一句/)
  assert.match(scene.querySelector(".rd-call-progress").textContent, /1\s*\/\s*3/)
  assert.equal(document.activeElement, advance)
})

test("each pointer activation reveals exactly one line and preserves prior lines", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "video",
    senderId: "contact-1",
    callLines: ["第一句", "第二句", "第三句"],
  }] }))

  let scene = await openFirstCall("reader-call-pointer")
  const storageBeforeAdvance = snapshotLocalStorage()
  scene.querySelector(".rd-call-advance").dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    detail: 1,
  }))
  scene = document.querySelector(".rd-call-scene")
  assert.deepEqual(
    [...scene.querySelectorAll(".rd-call-line")].map(line => line.textContent),
    ["第一句", "第二句"],
  )
  assert.equal(scene.querySelector(".rd-call-line.old").textContent, "第一句")
  assert.equal(scene.querySelector(".rd-call-line.current").textContent, "第二句")
  assert.doesNotMatch(scene.textContent, /第三句/)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-advance"))
  assert.deepEqual(snapshotLocalStorage(), storageBeforeAdvance)
})

test("the completed call remains visible and moves focus to Hang Up", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["第一句", "第二句"],
  }] }))

  let scene = await openFirstCall("reader-call-complete")
  scene.querySelector(".rd-call-advance").click()
  scene = document.querySelector(".rd-call-scene")
  assert.ok(scene)
  assert.equal(scene.querySelector(".rd-call-advance"), null)
  assert.match(scene.querySelector(".rd-call-complete").textContent, /通话内容已结束/)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-hangup"))
})

test("early Hang Up restores its card and reopening restarts at line one", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["第一句", "第二句", "第三句"],
  }] }))

  let scene = await openFirstCall("reader-call-reopen")
  scene.querySelector(".rd-call-advance").click()
  scene.querySelector(".rd-call-hangup").click()
  const card = document.querySelector('.rd-call-card[data-call-key="0-0"]')
  assert.ok(card)
  assert.equal(document.activeElement, card)

  card.click()
  scene = document.querySelector(".rd-call-scene")
  assert.match(scene.textContent, /第一句/)
  assert.doesNotMatch(scene.textContent, /第二句|第三句/)
})

test("legacy text calls are escaped, complete, and focus Hang Up", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "legacy-call",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    text: '<img src=x onerror="globalThis.pwned=true">旧台词',
  }] }))

  const scene = await openFirstCall("reader-call-legacy-text")
  assert.match(scene.textContent, /<img src=x/)
  assert.equal(scene.querySelector("img[src=x]"), null)
  assert.equal(scene.querySelector(".rd-call-advance"), null)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-hangup"))
})

test("empty calls show an explicit empty state and keep Hang Up available", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "empty-call",
    type: "call",
    callMode: "video",
    senderId: "contact-1",
    callLines: [null, "   "],
    text: " ",
  }] }))

  const scene = await openFirstCall("reader-call-empty")
  assert.match(scene.querySelector(".rd-call-empty").textContent, /本次通话没有台词/)
  assert.equal(scene.querySelector(".rd-call-advance"), null)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-hangup"))
})
```

Extend the existing multiple-call test so both calls have two lines; advance the first, hang up, manually open the second, then reopen the first. At each opening assert only that call's first line is present and no other call auto-opens.

- [ ] **Step 2: Run the call integration test and verify RED**

Run:

```powershell
node --test tests/reader-phone-call.test.mjs
```

Expected: failures show all lines are mounted immediately, `.rd-call-advance`/empty/completed states are absent, and Hang Up does not restore focus.

- [ ] **Step 3: Import the playback model and replace `openCallScene()`**

At the top of `reader/reader.js`, add:

```js
import { advanceCallPlayback, createCallPlaybackState } from './call-playback.js'
```

Replace only `openCallScene(msg, callKey)` with:

```js
function openCallScene(msg, callKey) {
  mayAutoOpenCall = false
  openedCallScenes[callKey] = true
  var caller = contacts.find(function(contact) { return contact.id === msg.senderId })
  var callerName = caller ? caller.name : getChatName()
  var modeLabel = msg.callMode === 'video' ? '视频通话' : '语音通话'
  var playback = createCallPlaybackState(msg.callLines, msg.text)

  function renderCallPlayback(advanced) {
    var currentLine = playback.currentIndex >= 0 ? playback.lines[playback.currentIndex] : ''
    var h = '<section class="rd-call-scene" aria-label="' + escapeHtmlAttribute('与' + callerName + '的' + modeLabel) + '">'
    h += '<div class="rd-call-status"><span>' + (msg.callMode === 'video' ? 'VIDEO CALL' : 'VOICE CALL') + '</span><span>' + (playback.isComplete ? '通话内容已结束' : '剧情进行中') + '</span></div>'
    h += '<div class="rd-call-tag">' + esc(callerName) + '打来的' + modeLabel + '</div>'
    h += '<div class="rd-call-portrait">'
    if (caller && caller.avatarUrl) h += '<img src="' + escapeHtmlAttribute(caller.avatarUrl) + '" alt="">'
    else h += '<span>' + esc((callerName || '?').charAt(0)) + '</span>'
    h += '</div><h3>' + esc(callerName) + '</h3><div class="rd-call-duration">正在通话</div>'

    if (playback.isEmpty) {
      h += '<div class="rd-call-transcript is-complete"><p class="rd-call-empty" role="status">本次通话没有台词</p></div>'
    } else {
      var transcriptTag = playback.isComplete ? 'div' : 'button'
      var transcriptAttributes = playback.isComplete
        ? ' class="rd-call-transcript is-complete"'
        : ' type="button" class="rd-call-transcript rd-call-advance" aria-label="显示下一句通话台词（' + (playback.currentIndex + 1) + ' / ' + playback.lines.length + '）"'
      h += '<' + transcriptTag + transcriptAttributes + '>'
      h += '<span class="rd-call-progress" aria-label="通话进度 ' + (playback.currentIndex + 1) + ' / ' + playback.lines.length + '">' + (playback.currentIndex + 1) + ' / ' + playback.lines.length + '</span>'
      h += '<span class="rd-call-lines">'
      for (var index = 0; index < playback.currentIndex; index++) {
        h += '<span class="rd-call-line old">' + esc(playback.lines[index]) + '</span>'
      }
      h += '<span class="rd-call-line current' + (advanced && shouldUseMotion(true) ? ' is-entering' : '') + '" aria-live="polite" aria-atomic="true">' + esc(currentLine) + '</span>'
      h += '</span>'
      if (playback.isComplete) h += '<span class="rd-call-complete" role="status">通话内容已结束</span>'
      else h += '<span class="rd-call-hint">点击、按 Enter 或空格显示下一句</span>'
      h += '</' + transcriptTag + '>'
    }

    h += '<div class="rd-call-note">通话是剧情的一部分；挂断后回到当前聊天。</div>'
    h += '<button type="button" class="rd-call-hangup" aria-label="挂断通话">挂断</button>'
    h += '</section>'
    frame.innerHTML = h

    var advance = frame.querySelector('.rd-call-advance')
    var hangup = frame.querySelector('.rd-call-hangup')
    if (advance) {
      advance.onclick = function() {
        playback = advanceCallPlayback(playback)
        renderCallPlayback(true)
      }
      advance.focus()
    } else {
      hangup.focus()
    }
    hangup.onclick = function() {
      renderChat()
      focusReaderControl(frame, '.rd-call-card[data-call-key="' + callKey + '"]')
    }
    var transcript = frame.querySelector('.rd-call-lines')
    if (transcript) transcript.scrollTop = transcript.scrollHeight
  }

  renderCallPlayback(false)
}
```

- [ ] **Step 4: Run focused playback tests and verify GREEN**

Run:

```powershell
node --test tests/reader-call-playback.test.mjs tests/reader-phone-call.test.mjs
```

Expected: pure and DOM call tests pass. JSDOM proves pointer behavior and native-button markup; real-browser verification in Task 6 proves Enter/Space default activation without a custom key handler.

- [ ] **Step 5: Inspect the scoped integration diff without staging it**

Run:

```powershell
git diff --check -- reader/reader.js tests/reader-phone-call.test.mjs
git diff -- reader/reader.js tests/reader-phone-call.test.mjs
```

Expected: no future line is embedded in markup, no timer/global listener/storage write exists, and playback state is local to each `openCallScene()` call.

---

### Task 3: Ship the rolling transcript visual, focus, contrast, and reduced-motion contract

**Files:**
- Modify: `reader/reader.css:2149-2181`
- Modify: `tests/reader-phone-accessibility.test.mjs`
- Modify: `tests/default-color-contrast.test.mjs`

**Interfaces:**
- Produces: four code-owned call surfaces selected by `data-call-background="plain|rose|water|cream"`.
- Produces: optional safe image layer through `--rd-call-image` and `.has-call-background-image`.
- Preserves: phone desktop wallpaper CSS outside `.rd-call-scene`.

- [ ] **Step 1: Add failing CSS/accessibility assertions**

Append to `tests/reader-phone-accessibility.test.mjs`:

```js
test("reader calls expose native focusable controls without a dotted call surface", () => {
  const scene = ruleBodiesFor(cssWithoutComments, ".rd-call-scene")
  const advance = ruleBodiesFor(cssWithoutComments, ".rd-call-advance")
  const hangup = ruleBodiesFor(cssWithoutComments, ".rd-call-hangup")
  const advanceFocus = ruleBodiesFor(cssWithoutComments, ".rd-call-advance:focus-visible")
  const hangupFocus = ruleBodiesFor(cssWithoutComments, ".rd-call-hangup:focus-visible")

  assert.match(readerSource, /var transcriptTag = playback\.isComplete \? 'div' : 'button'/)
  assert.match(readerSource, /type="button" class="rd-call-transcript rd-call-advance/)
  assert.doesNotMatch(readerSource, /rd-call-advance[^\n]+onkeydown/)
  assert.doesNotMatch(scene, /radial-gradient\s*\(/)
  assert.match(advance, /min-height\s*:\s*44px/)
  assert.match(hangup, /min-height\s*:\s*44px/)
  assert.match(advanceFocus, /outline\s*:\s*2px\s+solid/)
  assert.match(advanceFocus, /outline-offset\s*:\s*2px/)
  assert.match(hangupFocus, /outline\s*:\s*2px\s+solid/)
})

test("reader call line motion has an explicit reduced-motion override", () => {
  const reducedStart = css.lastIndexOf("@media (prefers-reduced-motion: reduce)")
  assert.notEqual(reducedStart, -1)
  const reduced = css.slice(reducedStart)
  assert.match(reduced, /\.rd-call-line\.current\.is-entering[\s\S]*animation\s*:\s*none\s*!important/)
  assert.match(reduced, /\.rd-call-line\.current\.is-entering[\s\S]*transform\s*:\s*none/)
})
```

Add this helper and test to `tests/default-color-contrast.test.mjs`:

```js
function hexTokenAnywhere(css, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*:\\s*(#[0-9a-f]{6})`, "i"))?.[1]
}

test("reader call presets and transcript paper preserve AA contrast", () => {
  const ink = hexTokenAnywhere(readerCss, "--rd-call-ink")
  const oldInk = hexTokenAnywhere(readerCss, "--rd-call-old-ink")
  const paper = hexTokenAnywhere(readerCss, "--rd-call-paper")
  const surfaces = [
    "--rd-call-plain-start", "--rd-call-plain-end",
    "--rd-call-rose-start", "--rd-call-rose-end",
    "--rd-call-water-start", "--rd-call-water-end",
    "--rd-call-cream-start", "--rd-call-cream-end",
  ].map(name => [name, hexTokenAnywhere(readerCss, name)])

  assert.ok(ink && oldInk && paper)
  for (const [name, surface] of surfaces) {
    assert.ok(surface, `${name} exists`)
    assert.ok(contrastRatio(ink, surface) >= 4.5, `${name} keeps call ink readable`)
  }
  assert.ok(contrastRatio(ink, paper) >= 4.5)
  assert.ok(contrastRatio(oldInk, paper) >= 4.5)
  assert.match(ruleBody(readerCss, ".rd-call-scene"), /rgba\(0,\s*0,\s*0,\s*\.58\)/)
  for (const selector of [".rd-call-duration", ".rd-call-note", ".rd-call-line.old"]) {
    assert.doesNotMatch(ruleBody(readerCss, selector), /opacity\s*:\s*(?:0?\.)\d+/)
  }
})
```

- [ ] **Step 2: Run the accessibility/contrast tests and verify RED**

Run:

```powershell
node --test tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs
```

Expected: missing advance styles/tokens/reduced-motion rule fail; Hang Up is 43px; old semantic text still uses fractional opacity.

- [ ] **Step 3: Replace the call CSS block with the approved rolling transcript treatment**

Replace the `.rd-call-card` through `.rd-call-hangup:focus-visible` block in `reader/reader.css` with:

```css
/* ---- Phone call story scene ---- */
.rd-call-card {
  width: 100%;
  min-height: 58px;
  margin: 7px 0;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(111, 78, 88, .45);
  border-radius: 3px;
  background: var(--phone-system-primary);
  color: var(--phone-system-primary-ink);
  box-shadow: 2px 2px rgba(74, 50, 57, .2);
  appearance: none;
  text-align: left;
  cursor: pointer;
}
.rd-call-card > span:first-child { width: 30px; height: 30px; border: 1px solid rgba(255,255,255,.72); display: grid; place-items: center; font-size: 15px; }
.rd-call-card > span:nth-child(2) { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rd-call-card strong { font-size: 11px; }
.rd-call-card small { font-size: 8px; color: #f8edf0; }
.rd-call-card b { text-align: center; font-size: 16px; }
.rd-call-card:focus-visible { outline: 2px solid var(--c-primary-hover); outline-offset: 2px; }

.rd-call-scene {
  --rd-call-ink: #ffffff;
  --rd-call-old-ink: #f3dfe5;
  --rd-call-paper: #302429;
  --rd-call-plain-start: #855b67;
  --rd-call-plain-end: #4d3940;
  --rd-call-rose-start: #875367;
  --rd-call-rose-end: #4f3540;
  --rd-call-water-start: #4f6877;
  --rd-call-water-end: #30434e;
  --rd-call-cream-start: #78604d;
  --rd-call-cream-end: #493a31;
  --rd-call-surface: linear-gradient(180deg, var(--rd-call-plain-start), var(--rd-call-plain-end));
  position: absolute;
  inset: 0;
  z-index: 60;
  min-height: 0;
  overflow: hidden;
  padding: 0 20px 92px;
  background-color: var(--rd-call-plain-end);
  background-image: linear-gradient(rgba(0, 0, 0, .58), rgba(0, 0, 0, .72)), var(--rd-call-image, none), var(--rd-call-surface);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  color: var(--rd-call-ink);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rd-call-scene[data-call-background="rose"] { --rd-call-surface: linear-gradient(135deg, var(--rd-call-rose-start), var(--rd-call-rose-end)); }
.rd-call-scene[data-call-background="water"] { --rd-call-surface: linear-gradient(135deg, var(--rd-call-water-start), var(--rd-call-water-end)); }
.rd-call-scene[data-call-background="cream"] { --rd-call-surface: linear-gradient(135deg, var(--rd-call-cream-start), var(--rd-call-cream-end)); }
.rd-call-status { width: calc(100% + 40px); min-height: 30px; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.5); font: 700 7px/1 ui-monospace, monospace; letter-spacing: .1em; }
.rd-call-tag { margin-top: 18px; padding: 5px 10px; border: 1px solid rgba(255,255,255,.72); background: var(--rd-call-paper); font: 700 8px/1.3 ui-monospace, monospace; }
.rd-call-portrait { width: 76px; height: 76px; margin: 13px auto 7px; border: 2px solid #fff0f2; background: #8a5c69; box-shadow: 0 0 0 5px rgba(255,255,255,.2); display: grid; place-items: center; font: 700 25px/1 ui-monospace, monospace; overflow: hidden; }
.rd-call-portrait img { width: 100%; height: 100%; object-fit: cover; }
.rd-call-scene h3 { margin: 5px 0 3px; font-size: 13px; }
.rd-call-duration { color: #f8edf0; font: 700 8px/1 ui-monospace, monospace; }
.rd-call-transcript { width: 100%; min-height: 136px; margin: 18px 0 0; padding: 10px; border: 1px solid rgba(255,255,255,.55); border-radius: 4px; background: var(--rd-call-paper); color: var(--rd-call-ink); text-align: left; display: flex; flex-direction: column; gap: 8px; }
button.rd-call-transcript { appearance: none; cursor: pointer; font: inherit; }
.rd-call-advance { min-height: 44px; }
.rd-call-advance:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
.rd-call-progress { align-self: flex-end; color: #f8edf0; font: 700 8px/1 ui-monospace, monospace; }
.rd-call-lines { min-height: 0; max-height: 150px; overflow-y: auto; scrollbar-width: none; display: flex; flex-direction: column; gap: 8px; }
.rd-call-lines::-webkit-scrollbar { display: none; }
.rd-call-line { display: block; padding: 7px 9px; border-left: 2px solid #efcad3; background: #49363e; color: var(--rd-call-ink); font-size: 10px; line-height: 1.55; }
.rd-call-line.old { border-left-color: #b9929d; background: #3b2d32; color: var(--rd-call-old-ink); font-size: 9px; }
.rd-call-line.current.is-entering { animation: rdCallLineIn .16s ease-out both; }
@keyframes rdCallLineIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.rd-call-hint, .rd-call-complete, .rd-call-empty { color: #f8edf0; font: 700 8px/1.4 ui-monospace, monospace; }
.rd-call-empty { margin: auto 0; text-align: center; }
.rd-call-note { position: absolute; left: 18px; right: 18px; bottom: 73px; color: #f8edf0; font: 600 7px/1.45 ui-monospace, monospace; }
.rd-call-hangup { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); width: 82px; min-height: 44px; border: 1px solid #f4dfe4; border-radius: 2px; background: #7a3f52; color: #fff; box-shadow: 3px 3px rgba(44,30,35,.35); font: 700 9px/1 ui-monospace, monospace; cursor: pointer; }
.rd-call-hangup:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
```

Inside the final `@media (prefers-reduced-motion: reduce)` block, add:

```css
.rd-call-line.current.is-entering {
  animation: none !important;
  transform: none;
}
```

- [ ] **Step 4: Run focused visual-contract tests and verify GREEN**

Run:

```powershell
node --test tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs tests/reader-phone-call.test.mjs tests/motion-preference.test.mjs
```

Expected: call controls, no-dot scope, AA tokens, progression DOM, and motion preference tests pass.

- [ ] **Step 5: Inspect the call-only CSS diff**

Run:

```powershell
git diff --check -- reader/reader.css tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs
git diff -- reader/reader.css tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs
```

Expected: the call block has no `radial-gradient`; the unrelated `.phone-frame.phone-default-wallpaper .phone-desktop` rule is unchanged.

---

### Task 4: Add defensive phone customization, normalized presets, and a draft-only Messages control

**Files:**
- Modify: `reader/reader.js:3,2332-2351,2611-2650,3010-3290`
- Modify: `reader/reader.css:1549-1835`
- Modify: `tests/reader-app-settings-dialog.test.mjs`
- Modify: `tests/reader-phone-call.test.mjs`
- Modify: `tests/reader-phone-accessibility.test.mjs`

**Interfaces:**
- Produces flat Messages fields: `callBackgroundType`, `callBackgroundPreset`, `callBackgroundImage`.
- Produces: `readerPlainRecord(value)` and a defensive `getPhoneCustom()` result even when persisted top-level or nested records are primitive/array-shaped.
- Produces: `normalizedReaderCallBackgroundSettings(settings)` and `readerCallBackgroundPresentation(settings)`.
- Produces settings hooks: `#cuCallBackgroundCard`, `.cu-call-background-preset`, `#cuCallBackgroundUpload`, `#cuCallBackgroundFile`, `#cuCallBackgroundPreview`, `#cuCallBackgroundRestore`, `#cuCallBackgroundError`.

- [ ] **Step 1: Add failing normalization, scope, draft, Save, Cancel, and Restore tests**

In `tests/reader-app-settings-dialog.test.mjs`, add `globalThis.Image = dom.window.Image` in `installDom()` and append:

```js
test("call background presets appear only in Messages and default safely", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      selfBubbleBg: "#123456",
      callBackgroundType: "script",
      callBackgroundPreset: "unknown",
      callBackgroundImage: "javascript:alert(1)",
    } },
  }))
  await import(`../reader/reader.js?call-background-defaults=${Date.now()}`)

  openNamedAppSettings("messages")
  const presets = [...document.querySelectorAll(".cu-call-background-preset")]
  assert.equal(presets.length, 4)
  assert.equal(presets.filter(button => button.getAttribute("aria-pressed") === "true").length, 1)
  assert.equal(presets.find(button => button.getAttribute("aria-pressed") === "true").dataset.cuCallBackgroundPreset, "plain")
  assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, "plain")
  document.getElementById("cuModalCancel").click()

  openNamedAppSettings("gallery")
  assert.equal(document.querySelector("#cuCallBackgroundCard"), null)
})

test("primitive and array-shaped phone customization cannot break settings", async t => {
  installDom(t)
  await import(`../reader/reader.js?call-background-corrupt-shapes=${Date.now()}`)

  const corruptValues = [
    "bad",
    [],
    { appSettings: "bad", customIcons: 42 },
    { appSettings: [], customIcons: [] },
  ]
  for (const value of corruptValues) {
    localStorage.setItem("moirain_phoneCustom", JSON.stringify(value))
    assert.doesNotThrow(() => openNamedAppSettings("messages"))
    assert.equal(
      document.querySelector('.cu-call-background-preset[aria-pressed="true"]').dataset.cuCallBackgroundPreset,
      "plain",
    )
    document.getElementById("cuModalCancel").click()
  }
})

test("call preset changes stay draft-only until Save and Cancel preserves raw storage", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    customIcons: { messages: "data:image/png;base64,AA==" },
    appSettings: { messages: { selfBubbleBg: "#123456" } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  await import(`../reader/reader.js?call-background-draft=${Date.now()}`)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-call-background-preset="water"]').click()
  assert.equal(document.querySelector('#cuCallBackgroundPreview').dataset.callBackground, "water")
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  document.getElementById("cuModalCancel").click()
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-call-background-preset="rose"]').click()
  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundType, "preset")
  assert.equal(saved.appSettings.messages.callBackgroundPreset, "rose")
  assert.equal(saved.appSettings.messages.callBackgroundImage, null)
  assert.equal(saved.appSettings.messages.selfBubbleBg, "#123456")
  assert.equal(saved.customIcons.messages, "data:image/png;base64,AA==")
})

test("Restore Default changes only the call background draft", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    customIcons: { messages: "kept-icon" },
    appSettings: { messages: {
      selfBubbleBg: "#123456",
      callBackgroundType: "image",
      callBackgroundPreset: "water",
      callBackgroundImage: "data:image/png;base64,AA==",
    } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  await import(`../reader/reader.js?call-background-restore=${Date.now()}`)

  openNamedAppSettings("messages")
  document.getElementById("cuCallBackgroundRestore").click()
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  assert.equal(document.querySelector('#cuCallBackgroundPreview').dataset.callBackground, "plain")
  document.getElementById("cuModalSave").click()

  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundType, "preset")
  assert.equal(saved.appSettings.messages.callBackgroundPreset, "plain")
  assert.equal(saved.appSettings.messages.callBackgroundImage, null)
  assert.equal(saved.appSettings.messages.selfBubbleBg, "#123456")
  assert.equal(saved.customIcons.messages, "kept-icon")
})

test("call background controls keep 44px targets and visible focus", () => {
  assert.match(
    readerCss,
    /\.cu-call-background-preset\s*,\s*\.cu-call-background-actions button\s*\{[^}]*min-height:\s*44px;/,
  )
  assert.match(
    readerCss,
    /\.cu-call-background-preset:focus-visible\s*,\s*\.cu-call-background-actions button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-primary-hover\);/,
  )
})
```

In `tests/reader-phone-call.test.mjs`, add a fixture with persisted preset `cream`; assert `.rd-call-scene` has `data-call-background="cream"`, no style containing the persisted unknown CSS, and both voice/video calls use the same setting. Add a second regression that opens a call after seeding `moirain_phoneCustom` as a string, an array, and `{ appSettings: "bad" }`; every shape must still open the scene with `data-call-background="plain"`.

In `tests/reader-phone-accessibility.test.mjs`, replace the broad `assert.doesNotMatch(readerSource, /isSafeImageUrl/)` with:

```js
assert.match(readerSource, /function isSafeReaderCallBackgroundDataUrl/)
assert.match(readerSource, /isSafeImageUrl\(value\)/)
```

This narrows the old custom-icon source assertion so the reader may use the repository sanitizer for the new local-only call surface.

- [ ] **Step 2: Run preset/settings tests and verify RED**

Run:

```powershell
node --test tests/reader-app-settings-dialog.test.mjs tests/reader-phone-call.test.mjs tests/reader-phone-accessibility.test.mjs
```

Expected: no call-background fields, controls, presentation attribute, or dedicated safe-image helper exist.

- [ ] **Step 3: Add defensive background normalization and presentation**

Extend the `sanitize.js` import in `reader/reader.js`:

```js
import { escapeHtmlAttribute, isSafeImageUrl, sanitizeCssColor, sanitizeIconHtml } from '../js/sanitize.js'
```

Add a plain-record boundary and replace `getPhoneCustom()` so corrupt truthy values cannot escape into call rendering or the settings modal:

```js
function readerPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function getPhoneCustom() {
  var defaults = {
    wallpaper: '#eee6e7', wallpaperType: 'color', wallpaperImage: null,
    frameColor: '#8f7b81', borderRadius: 18, fontFamily: "'Noto Sans SC', sans-serif",
    fontSize: 12, readerId: '', readerAvatar: null, topBgImage: null,
    showDynamicIsland: true, showHomeIndicator: true, showAppLabels: true,
    showIconShadow: true, iconBorderRadius: 6, iconColumns: 4, materialType: 'glass',
    materialOpacity: 65, timeColor: '#ffffff',
    appBgs: {}, appSettings: {}, customFonts: [], customIcons: {}
  }
  var stored = readerPlainRecord(lsGet('phoneCustom'))
  var custom = Object.assign(defaults, stored)
  custom.appBgs = Object.assign({}, readerPlainRecord(stored.appBgs))
  custom.appSettings = Object.assign({}, readerPlainRecord(stored.appSettings))
  custom.customIcons = Object.assign({}, readerPlainRecord(stored.customIcons))
  if (!Array.isArray(custom.customFonts)) custom.customFonts = []
  return custom
}
```

Above `getAppSettings(type)`, add:

```js
var READER_CALL_BACKGROUND_DEFAULT = Object.freeze({
  callBackgroundType: 'preset',
  callBackgroundPreset: 'plain',
  callBackgroundImage: null
})
var READER_CALL_BACKGROUND_PRESETS = Object.freeze({
  plain: '素灰粉',
  rose: '暮玫瑰',
  water: '雾水蓝',
  cream: '奶咖'
})
var READER_CALL_BACKGROUND_DATA_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i

function isSafeReaderCallBackgroundDataUrl(value) {
  return typeof value === 'string' &&
    READER_CALL_BACKGROUND_DATA_PATTERN.test(value.trim()) &&
    isSafeImageUrl(value)
}

function normalizedReaderCallBackgroundSettings(settings) {
  var source = settings && typeof settings === 'object' ? settings : {}
  var preset = typeof source.callBackgroundPreset === 'string' && Object.prototype.hasOwnProperty.call(READER_CALL_BACKGROUND_PRESETS, source.callBackgroundPreset)
    ? source.callBackgroundPreset
    : READER_CALL_BACKGROUND_DEFAULT.callBackgroundPreset
  var image = isSafeReaderCallBackgroundDataUrl(source.callBackgroundImage)
    ? source.callBackgroundImage.trim()
    : null
  var useImage = source.callBackgroundType === 'image' && image
  return {
    callBackgroundType: useImage ? 'image' : 'preset',
    callBackgroundPreset: preset,
    callBackgroundImage: useImage ? image : null
  }
}

function readerCallBackgroundPresentation(settings) {
  var background = normalizedReaderCallBackgroundSettings(settings)
  if (background.callBackgroundType === 'image') {
    return {
      className: ' has-call-background-image',
      attribute: 'image',
      style: '--rd-call-image:url("' + background.callBackgroundImage + '")'
    }
  }
  return {
    className: '',
    attribute: background.callBackgroundPreset,
    style: ''
  }
}
```

Replace `getAppSettings(type)` with the same defaults map plus a defensive copy boundary. The Messages entry gains these fields:

```js
callBackgroundType: 'preset',
callBackgroundPreset: 'plain',
callBackgroundImage: null
```

After the unchanged defaults map, use this exact tail instead of returning a raw stored value:

```js
var stored = ct.appSettings[type]
if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {}
var settings = Object.assign({}, defaults[type] || {}, stored)
if (type === 'messages') Object.assign(settings, normalizedReaderCallBackgroundSettings(settings))
return settings
```

This makes old, missing, array-shaped, and primitive persisted settings safe without mutating storage during reads.

At the start of `renderCallPlayback()`, compute:

```js
var background = readerCallBackgroundPresentation(getAppSettings('messages'))
```

Change the opening scene markup to:

```js
var h = '<section class="rd-call-scene' + background.className + '" data-call-background="' + background.attribute + '"' + (background.style ? ' style="' + escapeHtmlAttribute(background.style) + '"' : '') + ' aria-label="' + escapeHtmlAttribute('与' + callerName + '的' + modeLabel) + '">'
```

- [ ] **Step 4: Add the Messages-only draft controls and candidate Save**

At the start of `openReaderAppSettings(type, trigger)`, replace direct settings reuse with a private clone and normalized draft:

```js
var persistedSettings = getAppSettings(type)
var s = JSON.parse(JSON.stringify(persistedSettings))
var callBackgroundDraft = type === 'messages'
  ? normalizedReaderCallBackgroundSettings(s)
  : null
```

Add these helpers above `openReaderAppSettings()`:

```js
function readerCallBackgroundPreviewMarkup(background) {
  var presentation = readerCallBackgroundPresentation(background)
  return '<div id="cuCallBackgroundPreview" class="cu-call-background-preview' + presentation.className + '" data-call-background="' + presentation.attribute + '"' + (presentation.style ? ' style="' + escapeHtmlAttribute(presentation.style) + '"' : '') + '><span>通话背景预览</span></div>'
}

function readerCallBackgroundControls(background) {
  var buttons = Object.keys(READER_CALL_BACKGROUND_PRESETS).map(function(key) {
    var pressed = background.callBackgroundType === 'preset' && background.callBackgroundPreset === key
    return '<button type="button" class="cu-call-background-preset' + (pressed ? ' active' : '') + '" data-cu-call-background-preset="' + key + '" aria-label="选择' + READER_CALL_BACKGROUND_PRESETS[key] + '通话背景" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + READER_CALL_BACKGROUND_PRESETS[key] + '</button>'
  }).join('')
  return '<div class="cu-call-background-presets" role="group" aria-label="通话背景预设">' + buttons + '</div>' +
    readerCallBackgroundPreviewMarkup(background) +
    '<div class="cu-call-background-actions"><button type="button" id="cuCallBackgroundUpload">选择本地图片</button><input type="file" id="cuCallBackgroundFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="cuCallBackgroundRestore">恢复默认</button></div>' +
    '<p id="cuCallBackgroundError" class="cu-call-background-error" role="alert" hidden></p>'
}

function syncReaderCallBackgroundControls(modal, background) {
  modal.querySelectorAll('.cu-call-background-preset').forEach(function(button) {
    var pressed = background.callBackgroundType === 'preset' && button.dataset.cuCallBackgroundPreset === background.callBackgroundPreset
    button.classList.toggle('active', pressed)
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false')
  })
  var preview = modal.querySelector('#cuCallBackgroundPreview')
  if (preview) preview.outerHTML = readerCallBackgroundPreviewMarkup(background)
}
```

After the existing Messages time-label card, add:

```js
body += '<div id="cuCallBackgroundCard">' + cuCard('通话背景', readerCallBackgroundControls(callBackgroundDraft)) + '</div>'
```

After opening the modal, bind the dedicated controls:

```js
ov.querySelectorAll('.cu-call-background-preset').forEach(function(button) {
  button.onclick = function() {
    callBackgroundDraft = {
      callBackgroundType: 'preset',
      callBackgroundPreset: button.dataset.cuCallBackgroundPreset,
      callBackgroundImage: null
    }
    syncReaderCallBackgroundControls(ov, callBackgroundDraft)
  }
})
var callBackgroundRestore = ov.querySelector('#cuCallBackgroundRestore')
if (callBackgroundRestore) callBackgroundRestore.onclick = function() {
  callBackgroundDraft = Object.assign({}, READER_CALL_BACKGROUND_DEFAULT)
  syncReaderCallBackgroundControls(ov, callBackgroundDraft)
}
```

Immediately before `ct.appSettings[type] = s` in the modal Save callback, add:

```js
if (type === 'messages') Object.assign(s, normalizedReaderCallBackgroundSettings(callBackgroundDraft))
```

Keep `savePhoneCustom(ct)` inside `openCuModal()`'s guarded callback. Do not reuse `#cuAppReset`; that existing control resets the entire App immediately, while `#cuCallBackgroundRestore` only edits the background draft.

- [ ] **Step 5: Add preset-control CSS**

Add near the other `.cu-*` controls in `reader/reader.css`:

```css
.cu-call-background-presets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.cu-call-background-preset, .cu-call-background-actions button { min-height: 44px; padding: 8px 10px; border: 1px solid #c9d2df; border-radius: 6px; background: #fff; color: var(--c-text); font: 600 .72rem/1.2 var(--font); cursor: pointer; }
.cu-call-background-preset.active { border-color: var(--c-primary-hover); box-shadow: inset 0 0 0 1px var(--c-primary-hover); }
.cu-call-background-preset:focus-visible, .cu-call-background-actions button:focus-visible { outline: 2px solid var(--c-primary-hover); outline-offset: 2px; }
.cu-call-background-preview { --rd-call-surface: linear-gradient(180deg, var(--rd-call-plain-start, #855b67), var(--rd-call-plain-end, #4d3940)); min-height: 92px; margin-top: 10px; border-radius: 6px; display: grid; place-items: center; background-color: #4d3940; background-image: linear-gradient(rgba(0,0,0,.58), rgba(0,0,0,.72)), var(--rd-call-image, none), var(--rd-call-surface); background-position: center; background-size: cover; color: #fff; font-size: .75rem; }
.cu-call-background-preview[data-call-background="rose"] { --rd-call-surface: linear-gradient(135deg, #875367, #4f3540); }
.cu-call-background-preview[data-call-background="water"] { --rd-call-surface: linear-gradient(135deg, #4f6877, #30434e); }
.cu-call-background-preview[data-call-background="cream"] { --rd-call-surface: linear-gradient(135deg, #78604d, #493a31); }
.cu-call-background-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.cu-call-background-error { margin-top: 8px; color: #8a2d42; font-size: .72rem; line-height: 1.4; }
```

- [ ] **Step 6: Run preset/settings tests and verify GREEN**

Run:

```powershell
node --test tests/reader-app-settings-dialog.test.mjs tests/reader-phone-call.test.mjs tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs
```

Expected: safe defaults, Messages-only scope, draft/Cancel/Save/Restore, call presentation, target size, and existing settings tests pass.

- [ ] **Step 7: Inspect the preset/settings diff without staging it**

Run:

```powershell
git diff --check -- reader/reader.js reader/reader.css tests/reader-app-settings-dialog.test.mjs tests/reader-phone-call.test.mjs tests/reader-phone-accessibility.test.mjs
git diff -- reader/reader.js reader/reader.css tests/reader-app-settings-dialog.test.mjs tests/reader-phone-call.test.mjs tests/reader-phone-accessibility.test.mjs
```

Expected: unknown persisted keys cannot become CSS; the dedicated Restore control writes nothing until modal Save; no external URL input exists for call backgrounds.

---

### Task 5: Validate local raster uploads and make every failure retryable

**Files:**
- Modify: `reader/reader.js`
- Modify: `tests/reader-app-settings-dialog.test.mjs`
- Modify: `tests/reader-phone-call.test.mjs`

**Interfaces:**
- Produces: `readReaderCallBackgroundFile(file): Promise<string>`.
- Produces: `verifyReaderCallBackgroundDataUrl(dataUrl): Promise<string>` and an in-memory set containing only images decoded in the current page session.
- Enforces: exact allowed MIME, 2 MiB maximum, matching safe data URL, PNG/JPEG/WebP signatures, no APNG/WebP animation chunks, and successful non-zero image decode before any inline image style.
- Preserves: current draft and exact raw storage on every failure.

- [ ] **Step 1: Add async upload stubs and failing success/failure tests**

Add these helpers to `tests/reader-app-settings-dialog.test.mjs`:

```js
function setInputFiles(input, files) {
  Object.defineProperty(input, "files", { configurable: true, value: files })
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

function flushAsyncImageWork() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function installFileReader(t, { result, fail = false }) {
  const NativeFileReader = globalThis.FileReader
  let reads = 0
  globalThis.FileReader = class {
    readAsDataURL() {
      reads += 1
      queueMicrotask(() => {
        if (fail) this.onerror?.(new Event("error"))
        else {
          this.result = result
          this.onload?.({ target: this })
        }
      })
    }
  }
  t.after(() => { globalThis.FileReader = NativeFileReader })
  return () => reads
}

function installImageDecoder(t, { fail = false, width = 32, height = 24 } = {}) {
  const NativeImage = globalThis.Image
  globalThis.Image = class {
    constructor() {
      this.naturalWidth = width
      this.naturalHeight = height
    }
    set src(value) {
      this._src = value
      queueMicrotask(() => fail ? this.onerror?.() : this.onload?.())
    }
  }
  t.after(() => { globalThis.Image = NativeImage })
}

function rasterDataUrl(mime, binary) {
  return `data:${mime};base64,${Buffer.from(binary, "binary").toString("base64")}`
}
```

Use these signature-bearing static fixtures in parameterized success tests for PNG, JPEG, and WebP:

```js
const staticRasterCases = [
  ["image/png", rasterDataUrl("image/png", "\x89PNG\r\n\x1a\n")],
  ["image/jpeg", rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0")],
  ["image/webp", rasterDataUrl("image/webp", "RIFF\x04\x00\x00\x00WEBP")],
]
```

For each case: open Messages settings, inject a matching file/data URL, await two `flushAsyncImageWork()` calls, assert preview `data-call-background="image"`, assert storage unchanged before Save, Save, then assert all three flattened fields.

Add explicit rejection tests for:

```js
const rejectedBeforeRead = [
  { name: "vector.svg", type: "image/svg+xml", size: 100 },
  { name: "animated.gif", type: "image/gif", size: 100 },
  { name: "unknown.bin", type: "", size: 100 },
  { name: "large.png", type: "image/png", size: (2 * 1024 * 1024) + 1 },
]
```

For every rejected-before-read case, assert `reads() === 0`, the preview remains unchanged, `#cuCallBackgroundError` is visible, and the exact raw storage string is unchanged.

Add separate tests for mismatched/malformed data URL, FileReader error, animated WebP with an `ANIM` or `ANMF` RIFF chunk, APNG with an `acTL` chunk, Image error, `naturalWidth === 0`, `naturalHeight === 0`, and `localStorage.setItem()` throwing on modal Save. Each must keep the previous draft visible, retain the exact stored raw value, keep the modal connected, and focus Save after a storage error.

Use these animation fixtures:

```js
const animatedWebp = rasterDataUrl(
  "image/webp",
  "RIFF\x0c\x00\x00\x00WEBPANIM\x00\x00\x00\x00",
)
const animatedPng = rasterDataUrl(
  "image/png",
  "\x89PNG\r\n\x1a\n\x00\x00\x00\x00acTL\x00\x00\x00\x00",
)
```

Finally, seed a syntactically safe image into `moirain_phoneCustom` and prove it is never placed in `style` before `Image.onload`. A successful decode may then switch the preview/call scene to `data-call-background="image"`; `Image.onerror`, zero dimensions, APNG, and animated WebP must leave the selected safe preset active with no `--rd-call-image` style. In `tests/reader-phone-call.test.mjs`, add `globalThis.Image = dom.window.Image` to `installDom()`, add the same controllable Image stub, and repeat the call-scene cases so corrupt persisted data cannot prevent a voice or video call from opening.

- [ ] **Step 2: Run the settings test and verify RED**

Run:

```powershell
node --test tests/reader-app-settings-dialog.test.mjs
```

Expected: upload currently has no dedicated validation pipeline or draft update; all new upload cases fail.

- [ ] **Step 3: Implement the complete validation and decode pipeline**

Add the size/MIME and animation/decode helpers beside the existing call-background helpers. Replace the earlier `isSafeReaderCallBackgroundDataUrl()` with the strengthened version shown below, so the finished file contains exactly one definition:

```js
var READER_CALL_BACKGROUND_MAX_BYTES = 2 * 1024 * 1024
var READER_CALL_BACKGROUND_MIME_PREFIXES = Object.freeze({
  'image/png': 'data:image/png;base64,',
  'image/jpeg': 'data:image/jpeg;base64,',
  'image/webp': 'data:image/webp;base64,'
})
var verifiedReaderCallBackgroundImages = new Set()

function readerCallBackgroundBinary(dataUrl) {
  try {
    return globalThis.atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  } catch (error) {
    return ''
  }
}

function readerCallBackgroundHasSupportedSignature(dataUrl, binary) {
  if (/^data:image\/png;base64,/i.test(dataUrl)) {
    return binary.slice(0, 8) === '\x89PNG\r\n\x1a\n'
  }
  if (/^data:image\/jpe?g;base64,/i.test(dataUrl)) {
    return binary.length >= 3 &&
      binary.charCodeAt(0) === 0xff &&
      binary.charCodeAt(1) === 0xd8 &&
      binary.charCodeAt(2) === 0xff
  }
  if (/^data:image\/webp;base64,/i.test(dataUrl)) {
    return binary.slice(0, 4) === 'RIFF' && binary.slice(8, 12) === 'WEBP'
  }
  return false
}

function readerCallBackgroundHasAnimation(dataUrl, binary) {
  if (/^data:image\/png;base64,/i.test(dataUrl)) {
    for (var pngOffset = 8; pngOffset + 12 <= binary.length;) {
      var pngSize = (
        ((binary.charCodeAt(pngOffset) << 24) >>> 0) +
        (binary.charCodeAt(pngOffset + 1) << 16) +
        (binary.charCodeAt(pngOffset + 2) << 8) +
        binary.charCodeAt(pngOffset + 3)
      ) >>> 0
      if (pngSize > binary.length - pngOffset - 12) return true
      var pngChunk = binary.slice(pngOffset + 4, pngOffset + 8)
      if (pngChunk === 'acTL') return true
      pngOffset += 12 + pngSize
    }
    return false
  }
  if (/^data:image\/webp;base64,/i.test(dataUrl)) {
    for (var offset = 12; offset + 8 <= binary.length;) {
      var chunk = binary.slice(offset, offset + 4)
      var size = (
        binary.charCodeAt(offset + 4) |
        (binary.charCodeAt(offset + 5) << 8) |
        (binary.charCodeAt(offset + 6) << 16) |
        (binary.charCodeAt(offset + 7) << 24)
      ) >>> 0
      if (chunk === 'ANIM' || chunk === 'ANMF') return true
      if (size > binary.length - offset - 8) return true
      offset += 8 + size + (size % 2)
    }
    return false
  }
  return false
}

function isSafeReaderCallBackgroundDataUrl(value) {
  var trimmed = typeof value === 'string' ? value.trim() : ''
  if (!READER_CALL_BACKGROUND_DATA_PATTERN.test(trimmed) || !isSafeImageUrl(trimmed)) return false
  var binary = readerCallBackgroundBinary(trimmed)
  return Boolean(binary) &&
    readerCallBackgroundHasSupportedSignature(trimmed, binary) &&
    !readerCallBackgroundHasAnimation(trimmed, binary)
}

function decodeReaderCallBackgroundImage(dataUrl) {
  return new Promise(function(resolve, reject) {
    var image = new Image()
    image.onload = function() {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(dataUrl)
      else reject(new Error('图片没有可用尺寸'))
    }
    image.onerror = function() { reject(new Error('图片无法解码')) }
    image.src = dataUrl
  })
}

function verifyReaderCallBackgroundDataUrl(dataUrl) {
  if (!isSafeReaderCallBackgroundDataUrl(dataUrl)) {
    return Promise.reject(new Error('图片格式无效或包含动画'))
  }
  return decodeReaderCallBackgroundImage(dataUrl).then(function(verified) {
    verifiedReaderCallBackgroundImages.add(verified)
    return verified
  })
}

function readReaderCallBackgroundFile(file) {
  return new Promise(function(resolve, reject) {
    var expectedPrefix = file && READER_CALL_BACKGROUND_MIME_PREFIXES[file.type]
    if (!expectedPrefix) {
      reject(new Error('请选择 PNG、JPEG 或 WebP 图片'))
      return
    }
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > READER_CALL_BACKGROUND_MAX_BYTES) {
      reject(new Error('图片不能超过 2 MiB'))
      return
    }
    var reader = new FileReader()
    reader.onerror = function() { reject(new Error('图片读取失败')) }
    reader.onload = function() {
      var dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl.toLowerCase().startsWith(expectedPrefix) || !isSafeReaderCallBackgroundDataUrl(dataUrl)) {
        reject(new Error('图片格式与文件类型不一致'))
        return
      }
      verifyReaderCallBackgroundDataUrl(dataUrl).then(resolve, reject)
    }
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 4: Gate persisted images behind fresh session decode before presentation**

Replace `readerCallBackgroundPresentation(settings)` with a cache-gated version. A syntactically safe persisted image therefore renders its selected preset until the current page session has decoded it successfully:

```js
function readerCallBackgroundPresentation(settings) {
  var background = normalizedReaderCallBackgroundSettings(settings)
  if (background.callBackgroundType === 'image' && verifiedReaderCallBackgroundImages.has(background.callBackgroundImage)) {
    return {
      className: ' has-call-background-image',
      attribute: 'image',
      style: '--rd-call-image:url("' + background.callBackgroundImage + '")'
    }
  }
  return {
    className: '',
    attribute: background.callBackgroundPreset,
    style: ''
  }
}
```

At the start of `renderCallPlayback()`, retain both the normalized candidate and its currently safe presentation:

```js
var callBackgroundSettings = normalizedReaderCallBackgroundSettings(getAppSettings('messages'))
var background = readerCallBackgroundPresentation(callBackgroundSettings)
```

Immediately after `frame.innerHTML = h`, verify a persisted image before applying it to the still-current scene:

```js
var renderedCallScene = frame.querySelector('.rd-call-scene')
if (callBackgroundSettings.callBackgroundType === 'image' &&
    !verifiedReaderCallBackgroundImages.has(callBackgroundSettings.callBackgroundImage)) {
  verifyReaderCallBackgroundDataUrl(callBackgroundSettings.callBackgroundImage).then(function(dataUrl) {
    if (!renderedCallScene || !renderedCallScene.isConnected) return
    renderedCallScene.classList.add('has-call-background-image')
    renderedCallScene.dataset.callBackground = 'image'
    renderedCallScene.style.setProperty('--rd-call-image', 'url("' + dataUrl + '")')
  }).catch(function() {
    // The already-rendered selected preset remains authoritative.
  })
}
```

Do not serialize the unverified candidate into markup while the promise is pending. The empty catch is deliberate because the selected safe preset is already visible and call playback must remain usable.

After `openCuModal()` returns in `openReaderAppSettings()`, gate a persisted image in the same way. Disable only modal Save while decode is pending; Cancel, preset selection, and Restore remain available:

```js
var pendingPersistedCallBackground = callBackgroundDraft && callBackgroundDraft.callBackgroundType === 'image'
  ? Object.assign({}, callBackgroundDraft)
  : null
if (pendingPersistedCallBackground && !verifiedReaderCallBackgroundImages.has(pendingPersistedCallBackground.callBackgroundImage)) {
  var pendingSaveButton = ov.querySelector('#cuModalSave')
  var pendingImageError = ov.querySelector('#cuCallBackgroundError')
  pendingSaveButton.disabled = true
  verifyReaderCallBackgroundDataUrl(pendingPersistedCallBackground.callBackgroundImage).then(function() {
    if (!ov.isConnected || callBackgroundDraft.callBackgroundImage !== pendingPersistedCallBackground.callBackgroundImage) return
    syncReaderCallBackgroundControls(ov, callBackgroundDraft)
  }).catch(function() {
    if (!ov.isConnected || callBackgroundDraft.callBackgroundImage !== pendingPersistedCallBackground.callBackgroundImage) return
    callBackgroundDraft = {
      callBackgroundType: 'preset',
      callBackgroundPreset: pendingPersistedCallBackground.callBackgroundPreset,
      callBackgroundImage: null
    }
    syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    if (pendingImageError) {
      pendingImageError.textContent = '之前保存的通话背景无法使用，已改用安全预设。'
      pendingImageError.hidden = false
    }
  }).finally(function() {
    if (ov.isConnected) pendingSaveButton.disabled = false
  })
}
```

The promise result must check that the reader has not selected a different draft while decode was pending. Failure changes only the modal draft; raw storage stays byte-for-byte unchanged until an explicit Save.

- [ ] **Step 5: Bind the hidden file input without mutating the saved candidate on failure**

After the preset/Restore bindings in `openReaderAppSettings()`, add:

```js
var callBackgroundUpload = ov.querySelector('#cuCallBackgroundUpload')
var callBackgroundFile = ov.querySelector('#cuCallBackgroundFile')
var callBackgroundError = ov.querySelector('#cuCallBackgroundError')
if (callBackgroundUpload && callBackgroundFile) {
  callBackgroundUpload.onclick = function() { callBackgroundFile.click() }
  callBackgroundFile.onchange = function() {
    var file = callBackgroundFile.files && callBackgroundFile.files[0]
    if (!file) return
    if (callBackgroundError) {
      callBackgroundError.hidden = true
      callBackgroundError.textContent = ''
    }
    readReaderCallBackgroundFile(file).then(function(dataUrl) {
      callBackgroundDraft = {
        callBackgroundType: 'image',
        callBackgroundPreset: callBackgroundDraft.callBackgroundPreset,
        callBackgroundImage: dataUrl
      }
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    }).catch(function(error) {
      if (callBackgroundError) {
        callBackgroundError.textContent = error && error.message ? error.message : '图片无法使用'
        callBackgroundError.hidden = false
      }
    }).finally(function() {
      callBackgroundFile.value = ''
    })
  }
}
```

Do not assign the data URL to `ct`, `s`, or local storage in this handler. The existing guarded modal Save is the only persistence boundary.

- [ ] **Step 6: Run all upload/settings paths and verify GREEN**

Run:

```powershell
node --test tests/reader-app-settings-dialog.test.mjs
node --test tests/reader-app-settings-dialog.test.mjs tests/reader-phone-call.test.mjs tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs
```

Expected: PNG/JPEG/static WebP pass; type/size/read/MIME/APNG/WebP-animation/decode/dimension/storage failures preserve the draft and exact prior storage while leaving recovery available. Persisted images never enter inline style before a successful current-session decode.

- [ ] **Step 7: Inspect the upload diff without staging it**

Run:

```powershell
git diff --check -- reader/reader.js tests/reader-app-settings-dialog.test.mjs
git diff -- reader/reader.js tests/reader-app-settings-dialog.test.mjs
```

Expected: no `image/*` wildcard, no URL input, no GIF/SVG acceptance, no preview before decode, no local-storage write before Save, and no raw user string becomes arbitrary CSS.

---

### Task 6: Full regression, production builds, browser acceptance, and independent review

**Files:**
- Verify: every file scoped by Tasks 1-5
- Verify: ordinary reader and editor-preview call paths

**Interfaces:**
- Consumes: pure playback state, real-reader call UI, normalized Messages settings, local image pipeline.
- Produces: evidence that focused tests, the full suite, both builds, and real-browser acceptance pass.

- [ ] **Step 1: Run the complete focused regression set**

Run:

```powershell
node --test tests/reader-call-playback.test.mjs tests/reader-phone-call.test.mjs tests/reader-app-settings-dialog.test.mjs tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs tests/reader-contact-context.test.mjs tests/reader-editor-preview.test.mjs tests/motion-preference.test.mjs
```

Expected: every focused test passes with zero failed, cancelled, or skipped-by-error tests.

- [ ] **Step 2: Run the complete Node test suite**

Run:

```powershell
npm test
```

Expected: exit code 0; the pre-change baseline was 722/722, and all newly added tests also pass.

- [ ] **Step 3: Run both production builds**

Run:

```powershell
npm run build:verify
```

Expected: TypeScript, editor multi-page build, and independent reader build all exit 0; temporary build output is cleaned. On this Windows workspace, request the existing sandbox escalation if the verifier needs the system temporary directory.

- [ ] **Step 4: Exercise the real browser acceptance matrix**

Reuse the active Vite server when available; otherwise run this in a hidden background process:

```powershell
npm run dev -- --host 127.0.0.1 --port 63397
```

In the real reader, verify:

1. Open one voice and one video call; each initially exposes only line 1.
2. Activate the transcript by click/tap, Enter, and Space; each activation reveals exactly one new line and never skips.
3. Confirm prior lines remain readable, the current line is dominant, and the newest line stays visible on a narrow phone viewport.
4. Hang up before completion; confirm the originating call card regains focus and reopening restarts at line 1.
5. Advance to the final line; confirm the scene stays open, the ended status appears, focus moves to Hang Up, and only explicit Hang Up returns to chat.
6. Confirm a second authored call does not auto-open after hanging up and never inherits the first call's progress.
7. Open Messages beautification; verify four named presets, synchronized pressed state, 44px controls, visible focus, Cancel, background-only Restore, and Save.
8. Upload a local PNG/JPEG/WebP and confirm the fixed overlay/readable paper surface. Attempt SVG, GIF, oversize, and corrupt files and confirm the prior preview remains.
9. Confirm there is no external URL field for call background and no dotted/radial texture inside the call scene.
10. Enable reduced motion and confirm line changes have no entry animation.
11. Open an author work through the real reader editor-preview bridge and repeat one call; confirm playback writes no work, recent, or progress storage.

- [ ] **Step 5: Request an independent scoped code review**

Dispatch a read-only reviewer with the approved design spec, this plan, and the scoped diff. Require checks for future-line DOM leakage, double keyboard advancement, multi-call state sharing, XSS/CSS injection, unsafe raster formats, animated WebP, exact storage preservation, focus loss, contrast, reduced motion, author-data writes, and accidental edits outside the expected files.

Expected: no Critical or Important issue remains unresolved. Fix each valid finding with a new failing regression test before changing implementation.

- [ ] **Step 6: Run fresh final verification after review fixes**

Run:

```powershell
node --test tests/reader-call-playback.test.mjs tests/reader-phone-call.test.mjs tests/reader-app-settings-dialog.test.mjs tests/reader-phone-accessibility.test.mjs tests/default-color-contrast.test.mjs tests/reader-contact-context.test.mjs tests/reader-editor-preview.test.mjs tests/motion-preference.test.mjs
npm test
npm run build:verify
git diff --check
git status --short
```

Expected: every test/build command exits 0; `git diff --check` is clean; status contains only the pre-existing dirty work plus the explicitly scoped files, with no generated build output and no staged implementation changes.
