# Forum Comment Interaction Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the author-side forum button rows with a Xiaohongshu-style comment layout, tap-to-reply, long-press sibling sorting, a compact edit/delete action menu, editable heart counts, and reader-only reply branches.

**Architecture:** Keep the persisted forum comment tree and existing reader choice runtime. Author comments become focusable interaction surfaces; their compact utility controls stop propagation, while the surface handles replies and long-press sorting. Selecting the special `self` identity while replying edits choices on the target comment, so the existing runtime inserts the reader reply and actor-specific follow-ups only after the reader chooses.

**Tech Stack:** Vanilla JavaScript, CSS, JSDOM/node:test, Vite.

## Global Constraints

- Preserve existing forum data and old works with choices already attached to non-reader comments.
- A root comment moves with its complete reply subtree.
- A nested reply can move only among siblings in the same reply container.
- The temporary action glyph is `×`; its menu contains `编辑` and `删除`.
- Only the special reader identity (`contactId: "self"`) unlocks creation of reply choices.
- The heart control edits the authored like count and never triggers reply or drag.

---

### Task 1: Comment structure and compact controls

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Produces: `data-forum-comment-action`, `data-forum-comment-likes`, and focusable `data-forum-comment-id` surfaces.
- Preserves: existing comment and reply IDs, content, choices, and nested replies.

- [x] Add a failing DOM test proving the old text action row and drag handle are absent.
- [x] Render root and nested comments as avatar/body/footer rows with a heart count and one `×` action button.
- [x] Add compact responsive styles, visible focus, hover/press feedback, and reduced-motion behavior.
- [x] Run `node --test tests/phone-social-choice-editor.test.mjs`.

### Task 2: Tap, long press, and action menu

**Files:**
- Modify: `js/pages/phone.js`
- Test: `tests/phone-social-choice-editor.test.mjs`
- Test: `tests/forum-comment-reorder.test.mjs`

**Interfaces:**
- Consumes: `reorderForumCommentTree(comments, sourceId, targetId, position)`.
- Produces: short-click reply, 420 ms long-press sorting, keyboard sibling sorting, and a fixed edit/delete menu.

- [x] Add failing tests for tapping a comment, opening the action menu, editing/deleting through it, and long-press suppression of the reply click.
- [x] Bind the surface click to `addComment(postId, commentId)` unless the event started from a utility control.
- [x] Bind pointer hold to drag the root subtree or nested sibling; keep `reorderForumCommentTree` as the container boundary.
- [x] Reuse viewport-safe fixed-menu placement and close behavior for the edit/delete menu.
- [x] Run the focused forum tests.

### Task 3: Reader identity and reply branches

**Files:**
- Modify: `js/pages/phone.js`
- Test: `tests/phone-social-choice-editor.test.mjs`
- Test: `tests/reader-social-choice-runtime.test.mjs`

**Interfaces:**
- Produces: identity `{ id:"self", name, avatar, isReader:true }` for reply composition.
- Consumes: `openThreadReplyChoiceEditor(owner, options)` and the existing `choices[].followUpMessages[]` schema.

- [x] Add a failing test proving the reader identity appears only for replies and opens the choice editor.
- [x] Add the reader identity to reply-time identity selection.
- [x] When selected, edit choices on the reply target and do not append a fixed comment.
- [x] Keep legacy choices editable by clicking their visible authored choice chips.
- [x] Verify each reader choice can retain different actor-specific follow-ups in the reader runtime.
- [x] Run author and reader social-choice tests.

### Task 4: Final verification

**Files:**
- Verify: `js/pages/phone.js`
- Verify: `css/styles.css`
- Verify: `reader/reader.js`
- Verify: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Produces: a buildable, backward-compatible forum editor redesign.

- [x] Run the focused author, reader, reorder, message, and placeholder suites.
- [x] Run `npm run build:verify`.
- [x] Run `git diff --check`.
- [x] Confirm port 8765 serves the new action-menu and reader-identity markers.
