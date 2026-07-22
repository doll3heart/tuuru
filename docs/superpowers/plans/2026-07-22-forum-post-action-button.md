# Forum Post Action Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate forum feature, pin, and drag controls with one approved image button that opens state actions on tap and starts reordering after a long press.

**Architecture:** Keep `forum-post-order.js` as the pure ordering/state layer. The author forum list renders one fixed-size image button; a short activation opens a document-level fixed menu, while a 420 ms pointer hold enables the existing same-pin-group drag algorithm. The approved source image is copied, cropped, and mildly desaturated into `public/icons`, and the built-in small-phone tutorial documents both gestures and keyboard access.

**Tech Stack:** Vanilla JavaScript modules, Pointer Events, CSS, PNG assets, JSDOM/node:test, Vite.

## Global Constraints

- Do not modify, rename, or move the licensed source file under `D:\jili`.
- Use `D:\jili\地雷系霓虹小图标_200\jili (149).png`; do not redraw or convert it to SVG.
- Preserve existing `pinned` and `featured` fields and all legacy fallbacks.
- Keep a 44×44 CSS-pixel touch target; render the cropped icon at approximately 28×14 CSS pixels.
- Tap opens pin/feature actions; a 420 ms hold enters drag mode; ArrowUp/ArrowDown remain the keyboard reorder path.
- Reordering remains inside the current pinned or unpinned group.

---

### Task 1: Prepare the approved image asset

**Files:**
- Create: `public/icons/forum-post-actions.png`

**Interfaces:**
- Consumes: licensed source PNG `jili (149).png`.
- Produces: cropped RGBA PNG used as `./icons/forum-post-actions.png`.

- [ ] **Step 1: Read the source alpha bounds and crop to visible pixels**

Use Pillow to convert the indexed PNG to RGBA and crop to `alpha.getbbox()` without changing the original.

- [ ] **Step 2: Reduce saturation mildly**

Apply `ImageEnhance.Color(image).enhance(0.72)` to RGB while preserving the source alpha channel.

- [ ] **Step 3: Save and validate**

Assert the output is RGBA, has transparent corners, and has non-zero visible coverage.

### Task 2: Replace three controls with one accessible gesture button

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Consumes: `toggleForumPostFlag(posts, id, flag)`, `reorderForumPosts(posts, sourceId, targetId, position)`, and `placeFixedMenuWithinViewport(menu, point)`.
- Produces: `[data-post-actions]`, `.forum-post-action-menu`, and short-tap/long-press behavior.

- [ ] **Step 1: Rewrite the integration test to require one button**

Assert each card has one `[data-post-actions]`, no `[data-post-feature]` or `[data-post-pin]`, tap opens a fixed menu with both actions, and the menu action updates state without opening the post.

- [ ] **Step 2: Add long-press drag coverage**

Hold the pointer for at least 420 ms before `pointermove`; verify an unpinned post reorders inside the unpinned group and a short tap does not reorder.

- [ ] **Step 3: Render the single button**

Render one button at the footer's right edge with an `<img src="./icons/forum-post-actions.png" alt="">` and an accessible label explaining tap, hold, and arrow-key behavior.

- [ ] **Step 4: Implement the fixed tap menu**

Append a `role="menu"` element to `document.body`, provide current-state labels such as `取消置顶`/`置顶帖子` and `取消加精`/`设为精华`, position it beside the trigger, focus its first item, and close it on outside pointer, Escape, resize, scroll, state selection, or rerender.

- [ ] **Step 5: Gate dragging behind a hold timer**

Start a 420 ms timer on primary `pointerdown`; only after it fires may movement add the dragging class and update a valid target. Clear the timer and listeners on pointerup/pointercancel, suppress the following click after a completed hold, and leave ArrowUp/ArrowDown reordering on the same button.

- [ ] **Step 6: Restyle the footer and interaction states**

Keep the 44×44 hit target transparent and quiet, size the cropped image at 28×14, add focus/pressed/dragging feedback, and disable transitions under `prefers-reduced-motion`.

### Task 3: Document the combined control

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Produces: searchable tutorial copy in the `phone` category.

- [ ] **Step 1: Add a failing tutorial assertion**

Require the tutorial source to mention the forum card's lower-right pink heart-ellipsis button, tap for pin/feature, long press for drag, and ArrowUp/ArrowDown keyboard fallback.

- [ ] **Step 2: Add the actionable FAQ route**

Add `我想置顶、加精或调整论坛帖子顺序` with the exact route `论坛 App → 帖子列表 → 帖子卡片右下角粉色爱心省略按钮` and explain the pinned-group boundary.

- [ ] **Step 3: Run focused tests**

Run `node --test tests/forum-post-order.test.mjs tests/phone-social-choice-editor.test.mjs tests/resources-page.test.mjs` and expect zero failures.

### Task 4: Verify the integrated change

**Files:**
- Verify only; do not clean unrelated working-tree files.

- [ ] **Step 1: Run the UI detector**

Run `node D:\Codex\home\skills\impeccable\scripts\detect.mjs --json css/styles.css js/pages/phone.js js/pages/resources.js` and resolve all findings in scope.

- [ ] **Step 2: Run full verification**

Run `npm run verify` and require all tests, TypeScript checks, and Vite production builds to pass.

- [ ] **Step 3: Check the patch**

Run `git diff --check` and `git status --short`; preserve all unrelated tracked and untracked work.

## Self-Review

- Spec coverage: approved PNG, lower saturation, one lower-right button, tap menu, long-press drag, keyboard fallback, tutorial, compatibility, and verification are all assigned.
- Placeholder scan: no TBD/TODO/future placeholders remain.
- Type consistency: state flags remain `pinned`/`featured`; the single trigger is consistently named `data-post-actions`.
