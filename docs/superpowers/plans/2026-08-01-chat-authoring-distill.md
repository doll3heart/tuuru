# Chat Authoring Distill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or execute this plan inline task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make message authoring follow familiar chat behavior by removing duplicate creation entries, keeping system as a real speaker, and replacing manual merged-forward forms with message multi-select.

**Architecture:** Keep every existing message data type readable and editable for backward compatibility. Simplify only the creation surface: text and system copy share the composer, time remains a contextual insertion, and merged forwards are assembled from selected source messages into one or more destination single chats.

**Tech Stack:** Vanilla JavaScript, DOM APIs, CSS, Node test runner, jsdom.

## Global Constraints

- Preserve all existing uncommitted work in the shared worktree.
- Do not remove legacy reader rendering or editing support for saved `forward`, `time`, `system-event`, or `contact-event` messages.
- Do not expose group-only authoring actions in a single chat.
- Do not commit or push without a separate user request.

---

### Task 1: Lock the simplified creation model with tests

**Files:**
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: existing `openSingleChat()` fixture and author editor DOM.
- Produces: regression contracts for system-speaker composition, reduced tool pages, and multi-select forwarding.

- [ ] Add a failing test proving the system speaker remains available and creates a `type: "system"` message rather than a time marker.
- [ ] Add a failing test proving the plus sheet does not expose system, time, manual forward, status, contact, or group event creation.
- [ ] Add a failing test proving right-click multi-select can forward selected messages to another contact without hand-entered transcript fields.
- [ ] Run `node --test tests/phone-message-editor.test.mjs` and confirm the new assertions fail for the intended missing behavior.

### Task 2: Distill the authoring surface

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `chatMessageQuoteSummary(message)` for semantic forwarded-message summaries.
- Produces: system composer messages with `type: "system"`; message selection state; recipient chooser; generated `forwardItems`.

- [ ] Keep the system speaker button and change composer submission from `type: "time"` to `type: "system"`.
- [ ] Render authored system messages as centered system rows in the author preview.
- [ ] Reduce the attachment sheet to two pages of actual attachment/card types and remove the redundant creation entries.
- [ ] Add “多选” to the message context menu and render a selection toolbar in place of the composer while selection is active.
- [ ] Build the recipient chooser from contacts, automatically create missing single chats, and append one generated merged-forward card per selected recipient.
- [ ] Add focused, accessible selection and recipient-row styles, including reduced-motion behavior.

### Task 3: Preserve reader compatibility and update guidance

**Files:**
- Modify: `reader/reader.js` only if `type: "system"` lacks a reader renderer.
- Modify: `css/phone-chat.css` only if the reader system row needs a style hook.
- Modify: `js/pages/resources.js`
- Modify: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: saved `type: "system"` author messages.
- Produces: centered reader rendering and accurate instructions for context insertion and multi-select forwarding.

- [ ] Confirm or add reader rendering for `type: "system"` without changing legacy event rendering.
- [ ] Replace instructions that direct authors to plus-sheet date/system buttons with composer and context-menu instructions.
- [ ] Document multi-select forwarding through PC right-click and phone/tablet long-press.

### Task 4: Verify the complete change

**Files:**
- Test: `tests/phone-message-editor.test.mjs`
- Test: `tests/reader-critical-flow.test.mjs`
- Test: `tests/reader-phone-story-events.test.mjs`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: all implemented author and reader behavior.
- Produces: release evidence only; no commit or push.

- [ ] Run the focused tests and fix any regressions.
- [ ] Run the full relevant phone-message regression suite.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check` and inspect `git status --short` for unintended files.
