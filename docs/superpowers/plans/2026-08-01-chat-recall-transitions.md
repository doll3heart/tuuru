# Chat Recall Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or execute this plan inline task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authors mark an existing message as recalled or failed from its context menu, then show the reader the original message briefly before its final state appears.

**Architecture:** A recalled message becomes a semantic `system-event` that retains a deep-cloned `recalledMessage` snapshot and a readable `originalText`. Reader chat session state records transition start times so the animation survives rerenders without replaying when the chat is reopened; failed messages disappear permanently for that reading session, while recalls settle into the existing revealable system-event UI.

**Tech Stack:** Vanilla JavaScript, DOM timers, CSS transitions, Node test runner, jsdom.

## Global Constraints

- Preserve existing uncommitted work and all legacy story-event rendering.
- Keep PC right-click and phone/tablet long-press on the shared context menu.
- Respect reduced-motion preferences while preserving understandable state order.
- Do not mutate the imported author work in the reader.
- Do not commit or push without a separate request.

---

### Task 1: Author context actions

**Files:**
- Modify: `tests/phone-message-editor.test.mjs`
- Modify: `js/pages/phone.js`

**Interfaces:**
- Produces: `system-event` messages with `eventKind: "recall"`, `recalledMessage`, `originalText`, `allowReveal`, and the original stable `id`.

- [x] Add a failing test that right-click “撤回” converts a written message without opening the generic event form.
- [x] Add a failing test that “取消撤回” restores the preserved message snapshot.
- [x] Implement recall and restore context actions while retaining the existing edit/delete actions.
- [x] Restrict “发送失败” to actual sent messages rather than time markers and system-event rows.

### Task 2: Reader transition runtime

**Files:**
- Modify: `tests/reader-phone-story-events.test.mjs`
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`

**Interfaces:**
- Consumes: `message.failed` and recall events containing `recalledMessage`.
- Produces: one-shot transient message rows, then either removal or a revealable recall event.

- [x] Add failing reader tests for failed-message disappearance and recall-message replacement.
- [x] Store per-chat transition start times and settled IDs in the detached reader session.
- [x] Render a transient bubble using the original sender and content summary.
- [x] Fade failed messages out without a system prompt.
- [x] Replace recalled bubbles with the existing “查看原文” system prompt.
- [x] Ensure flow messages advance only after the short transition has settled.
- [x] Add reduced-motion CSS that removes the fade but preserves the brief readable hold.

### Task 3: Guidance and verification

**Files:**
- Modify: `js/pages/resources.js`
- Modify: `tests/resources-page.test.mjs`

**Interfaces:**
- Produces: tutorial copy matching the shipped context actions and reader outcome.

- [x] Document “撤回” and “发送失败” under the existing message context menu entry.
- [x] Run focused author, reader, and tutorial tests.
- [x] Run the complete related phone-message regression suite.
- [x] Run `npm run build` and `git diff --check`.
