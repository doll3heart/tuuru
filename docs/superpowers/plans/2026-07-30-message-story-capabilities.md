# Message Story Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing message editor with native-looking story events, dynamic contact/group changes, richer share cards, and complete call outcomes without adding a new top-level screen.

**Architecture:** Add a small pure model for message-event normalization, labels, state transitions, and safe card data. Keep author editing in the existing `＋ 添加剧情内容` sheet, render the same vocabulary in author and reader views, and store reader-only interaction results in the existing per-work phone session so authored data stays immutable.

**Tech Stack:** Vanilla JavaScript ES modules, DOM rendering, CSS, Node test runner, JSDOM, Vite.

## Global Constraints

- Keep every capability inside the current message editor and chat surface.
- Do not add system TTS, audio generation, AI calls, or new external APIs.
- Do not change reply-option positioning.
- Preserve old exported works: missing new fields must normalize to safe defaults.
- Reader interaction state must never mutate the imported authored work.
- All motion must have a reduced-motion fallback and touch targets must remain usable on mobile.

---

### Task 1: Pure message story model

**Files:**
- Create: `js/chat-story-events.js`
- Create: `tests/chat-story-events.test.mjs`
- Modify: `js/phone-reading-flow.js`
- Test: `tests/phone-reading-flow.test.mjs`

**Interfaces:**
- Produces: `CHAT_STORY_EVENT_KINDS`, `CHAT_STORY_CARD_TYPES`, `normalizeChatStoryMessage(message)`, `chatStoryMessageLabel(message)`, `createChatStoryState(phoneData, chat)`, `applyChatStoryMessage(state, message)`.
- State contains detached `contacts`, `group`, `relationships`, `messageStates`, and `scheduleResponses`.

- [ ] **Step 1: Write failing model tests**

Cover recall visibility, reactions, contact profile/relationship changes, group membership/name/role changes, call outcomes, safe card defaults, and detached immutable state.

- [ ] **Step 2: Run model tests and confirm missing exports fail**

Run: `node --test tests/chat-story-events.test.mjs tests/phone-reading-flow.test.mjs`

- [ ] **Step 3: Implement normalization, labels, and state transitions**

Use explicit allow-lists for event kinds and card types; clamp durations; coerce all text fields; copy contact/group collections before applying events.

- [ ] **Step 4: Add reading-flow labels for every new type**

Map system events to their visible text and cards to concise labels such as `位置 · 白石街` or `文件 · 值班表.pdf`.

- [ ] **Step 5: Run the model tests**

Expected: all Task 1 tests pass.

### Task 2: Author event and call editors

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: model constants and normalization helpers from Task 1.
- Produces: existing-message edit support for `system-event`, `contact-event`, and extended `call.callStatus`.

- [ ] **Step 1: Add failing author-editor tests**

Assert the plus sheet exposes event/card groups, event forms preserve editing identity, contact/group targets use existing IDs, and call outcomes can be saved without scripted call lines.

- [ ] **Step 2: Run the focused author tests**

Run: `node --test --test-name-pattern="story event|call outcome" tests/phone-message-editor.test.mjs`

- [ ] **Step 3: Implement one progressive event editor**

Use a single inline sheet with category and event-kind selects. Show only fields required by the selected kind: duration, original text, target contact, profile values, relationship state, group role/member, or reaction.

- [ ] **Step 4: Extend the call editor**

Add outcomes `正常通话、对方取消、对方拒绝、无人接听、忙线、通话中断、切换视频`; require script lines only for normal calls.

- [ ] **Step 5: Render author previews and support context-menu editing**

System events use centered quiet rows; contact/group mutations preview their resulting copy; call outcomes use the compact completed-call vocabulary.

- [ ] **Step 6: Run author tests**

Expected: all focused author tests pass.

### Task 3: Author rich-card editor

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Produces: authoring and editing for `location`, `contact-card`, `file`, `music`, `forward`, and `schedule`.

- [ ] **Step 1: Add failing rich-card tests**

Cover field persistence, internal contact targets, line-based forwarded records, file text content, safe music URL handling, and schedule response labels.

- [ ] **Step 2: Implement card fields in the existing message modal**

Location accepts name/address/optional preview URL; file accepts name/type/size/text; forward accepts one `发送者：内容` record per line; schedule accepts title/time/place/details and response labels.

- [ ] **Step 3: Add all cards to the paged plus sheet**

Keep eight tools or fewer per page and label every page with text, not icon-only state.

- [ ] **Step 4: Render compact author previews**

Use shared semantic classes with the reader so CSS does not drift.

- [ ] **Step 5: Run author tests**

Expected: all Task 3 tests pass.

### Task 4: Reader events, dynamic identity, and interactions

**Files:**
- Modify: `reader/reader.js`
- Create: `tests/reader-phone-story-events.test.mjs`

**Interfaces:**
- Consumes: `applyChatStoryMessage`.
- Produces: per-work event state, recall/retry/burn/reaction/friend-request/schedule actions, dynamic contact/group identity, and complete call-status rendering.

- [ ] **Step 1: Add failing reader event tests**

Assert recall reveal, failed-message retry, friend request, contact rename/avatar/relationship persistence, group rename/member/role changes, call outcomes, and no mutation of authored phone data.

- [ ] **Step 2: Apply visible event messages in authored order**

Build runtime state from currently unlocked messages before rendering the chat header and each later message. Keep this state in the existing phone choice session.

- [ ] **Step 3: Bind reader interactions**

Retry changes only reader session state; recall reveal and burn disclosure are explicit buttons; reactions are accessible toggles; schedule/friend request actions store one response.

- [ ] **Step 4: Stop transient typing/burn timers on navigation**

Reuse the reader app lifecycle cleanup pattern used by voice playback.

- [ ] **Step 5: Run reader event tests**

Expected: all Task 4 tests pass.

### Task 5: Reader rich cards and picture-in-picture details

**Files:**
- Modify: `reader/reader.js`
- Modify: `tests/reader-phone-story-events.test.mjs`

**Interfaces:**
- Produces: location/contact/music cards and safe in-phone detail panels for files and forwarded records.

- [ ] **Step 1: Add failing card tests**

Assert internal cards never navigate externally, unsafe URLs are inert, file/forward panels close through the shared picture-in-picture layer, and schedule responses remain selected after rerender.

- [ ] **Step 2: Render cards**

Keep one clear title, one metadata line, and at most one action row per card.

- [ ] **Step 3: Reuse the shared phone PIP lifecycle**

File text and forwarded records open in a closable in-phone panel with a bounded scroll area.

- [ ] **Step 4: Run reader card tests**

Expected: all Task 5 tests pass.

### Task 6: Shared visual system and full verification

**Files:**
- Modify: `css/phone-chat.css`
- Modify: `tests/phone-visual-foundation.test.mjs`

**Interfaces:**
- Produces: shared system-row, card, reaction, outcome, progress, focus, coarse-pointer, and reduced-motion styles.

- [ ] **Step 1: Add failing visual-contract tests**

Require centered system events, touch-sized actions, no side-stripe accent, visible focus, bounded card text, and reduced-motion handling.

- [ ] **Step 2: Implement shared styles**

Use the current warm neutral tokens, one-pixel dividers, compact typography, and existing small-phone geometry.

- [ ] **Step 3: Run focused regressions**

Run: `node --test tests/chat-story-events.test.mjs tests/phone-reading-flow.test.mjs tests/phone-message-editor.test.mjs tests/reader-phone-story-events.test.mjs tests/reader-phone-voice.test.mjs tests/phone-visual-foundation.test.mjs tests/reader-critical-flow.test.mjs`

- [ ] **Step 4: Build and visually inspect desktop and mobile**

Run: `npm run build`

Inspect author add/edit flows, ordinary and customized chat backgrounds, every card, PIP close behavior, and phone-width wrapping.

- [ ] **Step 5: Check the final diff**

Run: `git diff --check`

Expected: no whitespace errors and no temporary preview files.
