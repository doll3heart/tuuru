# Shelf, Forum, and Tutorial Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the work-card drag affordance with selection controls, refine shared forum post spacing, and document the reusable-resource and phone-module behavior added in this work session.

**Architecture:** Make CSS-only visual adjustments against existing shared selectors so author and reader forum surfaces remain identical. Extend the existing searchable tutorial data rather than adding a new help surface.

**Tech Stack:** Vanilla JavaScript, CSS, Node test runner.

## Global Constraints

- Keep interactive-image and interactive-scene work out of scope.
- Work-card drag remains a dedicated accessible button.
- Article phone cards remain one card per App.
- Forum layout changes apply through the shared `.phone-frame` forum component.

---

### Task 1: Work-card drag slot parity

**Files:**
- Modify: `css/styles.css`
- Test: `tests/home-work-order-ui.test.mjs`

- [ ] Assert the drag button uses the selection control's top-right slot and disappears while collection selection is active.
- [ ] Move the drag button to `top:11px; right:11px; left:auto`.
- [ ] Move title collision padding from the left edge to the right edge.
- [ ] Run `node --test tests/home-work-order-ui.test.mjs`.

### Task 2: Shared forum post rhythm

**Files:**
- Modify: `css/phone-forum.css`
- Test: `tests/phone-forum-view.test.mjs`

- [ ] Assert post content has a small top margin and post actions have no top border.
- [ ] Add a small top margin to `.forum-post-content`.
- [ ] Remove the border between post content/media and the action row while retaining readable spacing.
- [ ] Run `node --test tests/phone-forum-view.test.mjs`.

### Task 3: Tutorial synchronization

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

- [ ] Assert the tutorial covers work sorting/pinning, named contact and NPC packs, append semantics, and one-card-per-App article modules.
- [ ] Add the work shelf entry and FAQ to “作品与书架”.
- [ ] Clarify article phone cards in the article guide and feature directory.
- [ ] Clarify named contact/NPC pack reuse and append behavior in the social/files guides.
- [ ] Run `node --test tests/resources-page.test.mjs`.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] Run the three targeted test files.
- [ ] Run `npm test`.
- [ ] Run `npm run build:verify`.
- [ ] Browser-check the work-card slot and shared forum detail at desktop and narrow widths.
- [ ] Run `git diff --check` and confirm no interactive-image or interactive-scene files were edited by this task.
