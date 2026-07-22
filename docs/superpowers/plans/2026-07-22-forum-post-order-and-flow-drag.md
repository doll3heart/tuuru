# Forum Post Order and Reading Flow Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add featured, pinned, and manually ordered forum posts, and make reading-flow sequence reordering work with touch, pen, mouse, and keyboard while clearly explaining that each message bubble is one sequence card.

**Architecture:** Keep authored array order as the source of truth and add a focused `forum-post-order.js` module that keeps pinned and ordinary post groups stable. Reuse the existing gray-pink controls and pointer-drag pattern from forum comments. Replace the reading-flow editor's process-global mouse closure with panel-local Pointer Events and a pure sequence reorder helper.

**Tech Stack:** Vanilla ES modules, DOM Pointer Events, CSS custom properties, Node test runner, JSDOM.

## Global Constraints

- Preserve legacy posts without `pinned` or `featured`; missing values behave as `false`.
- Never rewrite browser storage outside the current work save path.
- JSON and PNG exports must preserve identical post flags and order.
- Pinned posts stay before ordinary posts; manual reorder is allowed within the same pinned state.
- One reading-flow message card represents one authored message bubble; legacy round steps expand to their individual bubbles.

---

### Task 1: Forum post ordering domain

**Files:**
- Create: `js/forum-post-order.js`
- Create: `tests/forum-post-order.test.mjs`
- Modify: `js/data.js`

**Interfaces:**
- Produces: `orderedForumPosts(posts) -> Array`
- Produces: `toggleForumPostFlag(posts, postId, flag) -> { ok, posts }`
- Produces: `reorderForumPosts(posts, sourceId, targetId, position) -> { ok, posts, reason? }`

- [ ] Write tests proving stable pinned-first order, featured-state independence, reorder within a group, cross-group rejection, missing IDs, and input immutability.
- [ ] Run `node --test tests/forum-post-order.test.mjs`; expect failure because the module does not exist.
- [ ] Implement detached array operations and initialize new posts with `pinned:false` and `featured:false`.
- [ ] Re-run the test; expect all forum-order cases to pass.

### Task 2: Author and reader forum surfaces

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `reader/reader.js`
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Modify: `tests/phone-social-choice-editor.test.mjs`
- Modify: `tests/reader-app-secondary-controls.test.mjs`

**Interfaces:**
- Consumes: the three ordering functions from Task 1.
- Produces: `data-post-pin`, `data-post-feature`, and `data-post-drag` author controls.

- [ ] Add failing author tests for toggling featured/pinned state, pinned-first persistence, keyboard ArrowUp/ArrowDown reorder, and drag handles that do not open the post.
- [ ] Add failing reader tests for pinned-first list order plus compact `置顶` and `精华` labels.
- [ ] Render small sibling state buttons and a drag handle in each author list row; use Pointer Events with pointer capture and the same before/after feedback as forum comments.
- [ ] Render non-interactive reader badges without changing post data or reader-local state.
- [ ] Add focus-visible, dragging, drop-target, and reduced-motion styles using existing tokens.
- [ ] Run both focused UI test files; expect all new and existing cases to pass.

### Task 3: Reading-flow reorder repair and copy

**Files:**
- Modify: `js/phone-reading-flow.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Modify: `tests/phone-reading-flow.test.mjs`
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Produces: `reorderPhoneReadingFlowSequence(sequence, fromIndex, toIndex) -> Array`
- Consumes: current expanded message-level reading-flow sequence.

- [ ] Add a failing pure test proving stable sequence reorder and immutable invalid-index handling.
- [ ] Add a failing settings integration test that enables flow, dispatches pointerdown/move/up on a handle, and observes saved order.
- [ ] Remove `_flow*` process globals and `window.__flowDragInit`; bind pointer handlers inside the current settings panel and clean them on finish/cancel.
- [ ] Make only the handle initiate drag, support touch/pen/mouse, add keyboard ArrowUp/ArrowDown, and rebuild the current panel after a committed move.
- [ ] Replace the settings description with explicit copy: `消息中每个气泡是一张卡片；旧版整轮记录会自动拆成多张。`
- [ ] Run the two focused flow test files; expect all cases to pass.

### Task 4: Compatibility and release verification

**Files:**
- Modify: `tests/work-transport-parity.test.mjs`

- [ ] Extend the phone fixture with one pinned featured post and assert JSON/PNG reader semantics remain identical.
- [ ] Run `node --test tests/forum-post-order.test.mjs tests/phone-reading-flow.test.mjs tests/phone-message-editor.test.mjs tests/phone-social-choice-editor.test.mjs tests/reader-app-secondary-controls.test.mjs tests/work-transport-parity.test.mjs`; expect zero failures.
- [ ] Run `npm run verify`; expect all tests, TypeScript checks, and the Vite production build to pass.
- [ ] Run `git diff --check`; expect no whitespace errors.
- [ ] Inspect the author forum list and settings sequence at a 500×900 viewport; verify no horizontal overflow and 44px-equivalent drag targets on touch.
