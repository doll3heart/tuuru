# Reader Chat Bubble Skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers apply separate local raster skins to their own and the other party's message bubbles, with nine-slice edge preservation and adjustable text padding.

**Architecture:** Store each side's skin image, slice value, and padding in the existing `messages` appearance settings. Reuse the validated local-image reader, keep uploads draft-only until Save, render the skin with CSS `border-image`, and fall back to the existing color/radius bubble whenever no skin exists.

**Tech Stack:** Vanilla JavaScript, CSS custom properties and `border-image`, Node test runner with JSDOM.

## Global Constraints

- Keep all image handling local; do not call an API or AI service.
- Accept the existing validated PNG/JPEG/WebP raster formats, with the existing 2 MiB limit and animated-image rejection.
- Keep image, payment, link, and other special message cards unchanged; skin only `.chat-bubble`.
- Do not commit, push, or deploy unless the user asks.

---

### Task 1: Persist and Render Separate Bubble Skins

**Files:**
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: `validatedReaderCallBackgroundCandidate(value)`, `boundedReaderSetting(value, fallback, min, max)`.
- Produces: message settings `selfBubbleSkinImage`, `otherBubbleSkinImage`, `selfBubbleSkinSlice`, `otherBubbleSkinSlice`, `selfBubbleSkinPadding`, and `otherBubbleSkinPadding`; helper `readerBubbleSkinVariables(settings)`.

- [ ] **Step 1: Write the failing rendering tests**

```js
assert.match(preview.querySelector(".chat-msg.self .chat-bubble").className, /has-bubble-skin/)
assert.equal(preview.style.getPropertyValue("--chat-self-bubble-slice"), "18")
assert.equal(preview.style.getPropertyValue("--chat-other-bubble-padding"), "10px")
assert.match(sharedChatCssBody(".phone-frame .chat-bubble.has-bubble-skin"), /border-image/)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/reader-app-settings-dialog.test.mjs`

Expected: FAIL because bubble-skin settings, classes, and CSS variables do not exist.

- [ ] **Step 3: Add normalized settings and runtime/preview rendering**

```js
function normalizedReaderBubbleSkin(settings, side) {
  var prefix = side === 'self' ? 'self' : 'other'
  var image = validatedReaderCallBackgroundCandidate(settings[prefix + 'BubbleSkinImage'])
  return {
    image: image ? image.dataUrl : null,
    slice: boundedReaderSetting(settings[prefix + 'BubbleSkinSlice'], 16, 4, 40),
    padding: boundedReaderSetting(settings[prefix + 'BubbleSkinPadding'], 8, 4, 18)
  }
}
```

Append safe CSS custom properties to both the real message shell and preview shell, add `has-bubble-skin` only for the corresponding side, and use:

```css
.phone-frame .chat-bubble.has-bubble-skin {
  box-sizing: border-box;
  border-style: solid;
  border-color: transparent;
  border-image-repeat: stretch;
  border-image-width: 1;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
```

Side selectors provide `border-width`, `border-image-source`, `border-image-slice: <number> fill`, and padding from the corresponding variables.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --test tests/reader-app-settings-dialog.test.mjs`

Expected: PASS.

### Task 2: Add Draft-Only Upload and Fine-Tuning Controls

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: `readReaderCallBackgroundFile(file)`, `updateCuPreview(modal, type)`, and the existing dirty-signature/save/reset flow.
- Produces: upload, clear, state, edge-preservation, and text-padding controls for `self` and `other`.

- [ ] **Step 1: Write failing interaction tests**

```js
setInputFiles(document.getElementById("cuSelfBubbleSkinFile"), [{ type:"image/png", size:8 }])
await flushAsyncImageWork()
assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
assert.match(document.querySelector(".chat-msg.self .chat-bubble").className, /has-bubble-skin/)
document.getElementById("cuModalSave").click()
assert.equal(saved.appSettings.messages.selfBubbleSkinImage, imageUrl)
```

Also assert that clearing one side does not clear the other, `bubbles` reset clears both images, and slice/padding values persist.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/reader-app-settings-dialog.test.mjs`

Expected: FAIL because the controls and draft fields do not exist.

- [ ] **Step 3: Add compact controls and handlers**

Place a single `气泡皮肤` row inside each existing side subsection. Each row contains `选择图片`, `清除`, state/error text, and two range controls labeled `边缘保留` and `文字留白`. Use modal draft fields:

```js
modal._readerBubbleSkinDraft = {
  self: settings.selfBubbleSkinImage || null,
  other: settings.otherBubbleSkinImage || null
}
```

Upload through `readReaderCallBackgroundFile`, disable Save while decoding, ignore stale async completions with a per-side operation version, and update preview without writing local storage. Save, whole-app reset, per-section reset, dirty detection, and original-preview comparison all consume the same draft fields.

- [ ] **Step 4: Add restrained control styling**

Use the existing 44px button vocabulary, a quiet state line, disabled tuning controls when no skin is selected, visible focus rings, and a one-column mobile layout under 520px.

- [ ] **Step 5: Run focused and full verification**

Run:

```powershell
node --test tests\reader-app-settings-dialog.test.mjs
npm run build:verify
```

Expected: both commands exit 0 with no failed tests.

