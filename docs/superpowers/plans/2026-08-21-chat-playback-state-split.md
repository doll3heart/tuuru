# Chat Playback State Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make phone-chat waiting, typing presence, and text reveal independent and deterministic across legacy works, reduced-motion devices, special delivery states, and chat re-renders.

**Architecture:** Add a small pure playback-state module that owns initial-delay policy, text reveal eligibility, and resumable character progress. Keep reply-pace normalization in the choice runtime, while the reader session stores text progress outside the DOM and clears it only when playback completes or a branch is rolled back.

**Tech Stack:** JavaScript ES modules, Node test runner, JSDOM, Vite.

## Global Constraints

- Preserve authored message order for text, images, cards, and system messages.
- “逐字出现” is author-controlled and is not disabled by the device reduced-motion preference.
- Reader-authored replies and typing indicators appear immediately; the first NPC/system response uses the same default 800 ms wait as later messages.
- Legacy choices without `replyPace` use the current authoring default `normal`.
- Do not mutate unrelated user-owned untracked files.

---

### Task 1: Pure playback contract

**Files:**
- Create: `js/chat-playback-state.js`
- Create: `tests/chat-playback-state.test.mjs`

**Interfaces:**
- Produces: `chatPlaybackInitialDelayMs(message, fallbackMs)`, `chatMessageUsesTextStream(message)`, `chatTextPlaybackSnapshot(text, index)`, and `advanceChatTextPlayback(text, index)`.

- [ ] **Step 1: Write failing pure-model tests**

Cover an immediate self reply, an immediate typing indicator, a default-delayed first NPC message, an explicit zero delay, streamed failed text, bounded progress, and one-character advancement.

- [ ] **Step 2: Run the focused test and confirm missing-module failure**

Run: `node --test tests/chat-playback-state.test.mjs`

Expected: FAIL because `js/chat-playback-state.js` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Use the existing `chatMessageDelayBeforeMs` and `normalizeChatMessageRevealMode` helpers; do not duplicate their normalization rules.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/chat-playback-state.test.mjs`

Expected: PASS.

### Task 2: Authoring and branch-generation semantics

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `js/chat-choice-runtime.js`
- Test: `tests/phone-message-editor.test.mjs`
- Test: `tests/chat-choice-runtime.test.mjs`

**Interfaces:**
- Consumes: existing `normalizeChatReplyPace` and authored `delayBeforeMs`/`revealMode` fields.
- Produces: explicit `revealMode` values, `normal` legacy choice pace, and recalled generated events that retain their top-level delay.

- [ ] **Step 1: Add failing editor and choice-runtime regressions**

Assert that saving “逐字出现” stores `revealMode:"stream"`, an undefined legacy pace opens/saves as `normal`, and a recalled follow-up retains `delayBeforeMs` on the generated recall event.

- [ ] **Step 2: Run the focused tests and confirm the new assertions fail**

Run: `node --test tests/phone-message-editor.test.mjs tests/chat-choice-runtime.test.mjs`

- [ ] **Step 3: Implement the serialization and generation fixes**

Normalize legacy choice pace with fallback `normal`, preserve explicit reveal mode, and copy `delayBeforeMs` to recalled system events.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/phone-message-editor.test.mjs tests/chat-choice-runtime.test.mjs`

Expected: PASS.

### Task 3: Resumable reader playback

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-chat-choice-runtime.test.mjs`
- Test: `tests/reader-phone-story-events.test.mjs`

**Interfaces:**
- Consumes: pure playback helpers from Task 1.
- Produces: `chatSession.flowTextProgress`, a `Map<messageId, characterIndex>` retained across `renderChat()` calls.

- [ ] **Step 1: Add failing reader regressions**

Assert that reduced-motion devices still stream authored stream text, a silent instant choice waits 800 ms before its first NPC reply, a mid-stream event-triggered render resumes from the saved prefix, and a failed text message obeys its reveal mode.

- [ ] **Step 2: Run the reader tests and confirm the new assertions fail**

Run: `node --test tests/reader-chat-choice-runtime.test.mjs tests/reader-phone-story-events.test.mjs`

- [ ] **Step 3: Store and render character progress outside the DOM**

Initialize `flowTextProgress` in each chat session, render its saved prefix, advance it per tick, clear it on completion/rollback, use `chatPlaybackInitialDelayMs` for the first generated item, and stop consulting `shouldUseMotion` for authored text reveal.

- [ ] **Step 4: Run the reader tests**

Run: `node --test tests/reader-chat-choice-runtime.test.mjs tests/reader-phone-story-events.test.mjs`

Expected: PASS.

### Task 4: Verification and documentation check

**Files:**
- Modify only if needed: `js/pages/resources.js`

**Interfaces:**
- Consumes: completed playback contract and UI behavior.
- Produces: verified code and accurate author-facing wording.

- [ ] **Step 1: Check tutorial wording**

Confirm that the tutorial distinguishes sending wait, typing presence, and text reveal, and says the blank wait defaults to 0.8 seconds including the first NPC response.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 3: Run build verification**

Run: `npm run build:verify`

Expected: exit code 0.

- [ ] **Step 4: Review the final diff and workspace state**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and no unrelated tracked changes.
