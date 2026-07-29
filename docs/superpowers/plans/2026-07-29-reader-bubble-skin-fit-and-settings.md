# Reader Bubble Skin Fit and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make complete-frame chat bubble artwork render at an adjustable useful size, align skinned bubbles with avatars, and simplify the message appearance controls.

**Architecture:** Add a `full` bubble-skin mode that paints the entire source as a stretched background and keeps the existing `slice` mode as an explicit alternative. Store a per-side size value, attach skin state to the message row for top alignment, and replace the long flat settings list with nested native details panels and picker-only color rows.

**Tech Stack:** Vanilla JavaScript, CSS custom properties/background images/border images, Node test runner with JSDOM.

## Global Constraints

- Existing saved skin images without a mode migrate to `full`.
- PNG/JPEG/WebP validation, draft-only upload, Save, undo comparison, and reset behavior remain unchanged.
- Special cards such as links, transfers, and red packets never receive bubble skins.
- Do not commit, push, or deploy unless the user asks.

---

### Task 1: Correct Complete-Frame Rendering and Alignment

**Files:**
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `selfBubbleSkinMode`, `otherBubbleSkinMode` (`full | slice`), `selfBubbleSkinSize`, `otherBubbleSkinSize` (`70..180`).

- [ ] **Step 1: Add failing tests**

```js
assert.equal(preview.style.getPropertyValue("--chat-self-bubble-min-height"), "56px")
assert.ok(preview.querySelector(".chat-msg.self").classList.contains("has-bubble-skin"))
assert.ok(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("bubble-skin-full"))
assert.match(sharedChatCss, /background-size:\s*100% 100%/)
assert.match(sharedChatCss, /\.chat-msg\.has-bubble-skin\s*\{[^}]*align-items:\s*flex-start/)
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests\reader-app-settings-dialog.test.mjs`

Expected: FAIL because full mode, size variables, and row alignment do not exist.

- [ ] **Step 3: Implement normalized mode/size and both render paths**

```js
return {
  image,
  mode: source[prefix + 'BubbleSkinMode'] === 'slice' ? 'slice' : 'full',
  size: boundedReaderSetting(source[prefix + 'BubbleSkinSize'], 100, 70, 180),
  slice: boundedReaderSetting(source[prefix + 'BubbleSkinSlice'], 16, 4, 40),
  padding: boundedReaderSetting(source[prefix + 'BubbleSkinPadding'], 12, 4, 32)
}
```

`full` uses `background-image`, `background-size: 100% 100%`, calculated minimum dimensions, and no crop. `slice` keeps `border-image`. Eligible skinned message rows receive `has-bubble-skin` and align to the top.

- [ ] **Step 4: Verify the focused tests pass**

Run: `node --test tests\reader-app-settings-dialog.test.mjs`

Expected: PASS.

### Task 2: Fold Settings and Remove Message Color Presets

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: nested details `cuMessageAvatar`, `cuMessageSelfBubble`, `cuMessageOtherBubble`, `cuMessageTypography`.

- [ ] **Step 1: Add failing structure tests**

```js
assert.deepEqual(
  [...document.querySelectorAll("#cuMessageBubbles > .cu-settings-section-body > details")].map(item => item.id),
  ["cuMessageAvatar", "cuMessageSelfBubble", "cuMessageOtherBubble", "cuMessageTypography"],
)
assert.equal(document.querySelectorAll("#cuMessageBubbles .cu-color-btn").length, 0)
assert.equal(document.querySelectorAll("#cuMessageBubbles .cu-color-picker").length, 5)
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests\reader-app-settings-dialog.test.mjs`

Expected: FAIL because subsections are static sections and preset buttons remain.

- [ ] **Step 3: Implement collapsible subsections and mode-aware controls**

Use native `<details>` with one side open by default. Add `完整素材 / 九宫格` controls, `整体大小`, and `文字留白`; show `边缘保留` only for `slice`. Preview clicks open the matching nested subsection. Pass empty preset arrays to every message color row so only the native picker remains.

- [ ] **Step 4: Add compact subsection styling**

Use 44px targets, restrained dividers, visible focus, a rotating chevron, and no nested card styling.

- [ ] **Step 5: Run verification**

Run:

```powershell
node --test tests\reader-app-settings-dialog.test.mjs
npm test
npm run build:verify
```

Expected: all commands exit 0 with no failed tests.

