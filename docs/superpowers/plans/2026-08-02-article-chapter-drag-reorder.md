# Article Chapter Drag Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authors to reorder whole interactive-novel chapters by dragging chapter handles, with an accessible keyboard alternative and durable saved order.

**Architecture:** Keep chapter order authoritative in `work.chapters`. A pure reorder helper validates and produces the next chapter array without mutating chapter objects. A delegated pointer/keyboard controller resolves chapter-row destinations and emits one semantic commit; the editor persists only `chapters`, then rerenders while preserving node selection and per-chapter view state.

**Tech Stack:** Native ES modules, delegated DOM pointer/keyboard events, localStorage-backed work persistence, Node test runner, JSDOM, CSS custom properties.

## Global Constraints

- Preserve every chapter object, node object, node `chapterId`, choice target, scene, and interactive-page relationship; allow the existing automatic entry-node rule to follow the first readable node in the newly first chapter.
- Start pointer sorting only from a dedicated chapter handle; chapter disclosure and action buttons must remain independent.
- Support `Alt+ArrowUp` and `Alt+ArrowDown` on the handle as a non-pointer equivalent.
- Cancel incomplete gestures cleanly on pointer cancellation, lost capture, blur, Escape, refresh, or controller destruction.
- Reuse the outline's existing colors, focus language, 44px coarse-pointer target contract, and reduced-motion preference.
- Do not expose reorder affordances while the outline is in target-picking mode.

---

## Task 1: Define chapter-order invariants

**Files:**
- Create: `js/article-chapter-reorder.js`
- Create: `tests/article-chapter-reorder.test.mjs`

- [x] Write failing unit tests for before/after moves, first/last positions, adjacent and self no-ops, missing or duplicate IDs, invalid placement, input immutability, and preservation of chapter object identity/metadata.
- [x] Run `node --test tests/article-chapter-reorder.test.mjs` and confirm the new test fails because the module does not exist.
- [x] Implement `reorderArticleChapter(chapters, { draggedId, targetId, placement })` returning `{ ok, changed, chapters }` or a stable failure reason.
- [x] Run the focused unit test and confirm it passes.

## Task 2: Implement the delegated chapter drag controller

**Files:**
- Create: `js/editor-chapter-drag.js`
- Create: `tests/editor-chapter-drag.test.mjs`

- [x] Build a fake-DOM harness covering pointer capture and document-level fallback listeners.
- [x] Write failing tests proving handle-only activation, movement threshold, row-midpoint before/after resolution, single commit, cleanup, cancellation, and keyboard boundary behavior.
- [x] Implement a delegated controller that adds only temporary `dragging`, `drop-before`, and `drop-after` classes and emits semantic reorder payloads.
- [x] Add `reset()` and `destroy()` cleanup contracts compatible with editor rerenders.
- [x] Run `node --test tests/editor-chapter-drag.test.mjs` and confirm it passes.

## Task 3: Render and persist chapter reordering

**Files:**
- Modify: `js/pages/editor.js`
- Create: `tests/article-chapter-drag-integration.test.mjs`
- Modify: `tests/article-outline-accessibility.test.mjs`

- [x] Render one named native button handle per normal chapter row, outside the disclosure button and action panel.
- [x] Initialize the controller once on `document`, reset it during rerenders, and commit by updating only `work.chapters` through the existing persistence path.
- [x] Keep the selected node selected after reorder and allow the stored collapsed chapter IDs to follow their chapters naturally.
- [x] Test pointer reorder, keyboard reorder, saved order after rerender, unchanged node IDs/chapter IDs/choice targets, automatic entry-node reconciliation, and absence of handles in target-picking mode.
- [x] Update structural accessibility assertions for the new sibling handle without weakening existing disclosure/action contracts.
- [x] Run `node --test tests/article-chapter-drag-integration.test.mjs tests/article-outline-accessibility.test.mjs`.

## Task 4: Polish feedback and responsive behavior

**Files:**
- Modify: `css/styles.css`
- Modify: `tests/article-chapter-drag-integration.test.mjs`

- [x] Style the chapter handle with grab/grabbing cursors, visible focus, restrained default opacity, and a full-row insertion line.
- [x] Keep chapter rows readable in bounded/mobile layouts and give coarse-pointer handles a 44px target.
- [x] Add reduced-motion handling and assert the required drag/drop CSS contracts.
- [x] Verify keyboard focus remains on the moved chapter handle after rerender.

## Task 5: Verify the complete workflow

**Files:**
- Modify: this plan file (checkbox status only)

- [x] Run the focused chapter reorder/controller/integration/accessibility tests.
- [x] Run `npm run verify` and fix any regressions without altering unrelated worktree changes.
- [x] In the local app, reorder a multi-chapter interactive novel by pointer and keyboard, reload it, and inspect desktop plus narrow/coarse-pointer layouts.
- [x] Confirm saved order persists and node links, selected node, collapsed state, and chapter actions still work.
