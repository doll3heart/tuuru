# Reader Voice Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn reader voice messages into local visual playback controls with play, pause, replay, countdown, progressive waveform, transcript disclosure, and automatic stop on navigation.

**Architecture:** Keep timing math in a small immutable module and let `openReaderChat()` own the single active interval and DOM synchronization. Persist only ephemeral playback and transcript state in the existing per-chat reader session; never mutate authored work or write playback state to storage.

**Tech Stack:** Browser JavaScript modules, DOM APIs, CSS, Node test runner, JSDOM.

## Global Constraints

- Do not use speech synthesis, audio generation, network requests, or AI APIs.
- Only one voice message may play at a time.
- Leaving the chat, opening another App, opening a call, or rerendering the chat stops playback.
- Transcript text remains an explicit disclosure separate from playback.
- Do not change phone reading-flow option positioning or behavior.

---

### Task 1: Immutable voice playback state

**Files:**
- Create: `reader/voice-playback.js`
- Create: `tests/reader-voice-playback-model.test.mjs`

**Interfaces:**
- Consumes: authored duration seconds and elapsed timer milliseconds.
- Produces: `createVoicePlaybackState`, `playVoicePlayback`, `pauseVoicePlayback`, `advanceVoicePlayback`, `resetVoicePlayback`, `toggleVoiceTranscript`, `voicePlaybackProgress`, and `voicePlaybackRemainingLabel`.

- [ ] **Step 1: Write the failing model tests**

```js
const state = createVoicePlaybackState(6)
assert.equal(state.status, "idle")
assert.equal(voicePlaybackRemainingLabel(state), "0:06")
assert.equal(advanceVoicePlayback(playVoicePlayback(state), 2500).elapsedMs, 2500)
assert.equal(pauseVoicePlayback(playVoicePlayback(state)).status, "paused")
```

- [ ] **Step 2: Run the model test and verify the missing module fails**

Run: `node --test tests/reader-voice-playback-model.test.mjs`

Expected: FAIL because `reader/voice-playback.js` does not exist.

- [ ] **Step 3: Implement immutable state transitions**

```js
export function advanceVoicePlayback(state, deltaMs) {
  if (state.status !== "playing") return { ...state }
  const elapsedMs = Math.min(state.durationMs, state.elapsedMs + Math.max(0, Number(deltaMs) || 0))
  return { ...state, elapsedMs, status: elapsedMs >= state.durationMs ? "completed" : "playing" }
}
```

- [ ] **Step 4: Run the model test**

Run: `node --test tests/reader-voice-playback-model.test.mjs`

Expected: PASS.

### Task 2: Reader chat lifecycle and accessible controls

**Files:**
- Modify: `reader/reader.js`
- Create: `tests/reader-phone-voice.test.mjs`

**Interfaces:**
- Consumes: the Task 1 playback functions and the existing `chatSession`.
- Produces: one `.rd-voice-message` per voice message with `.rd-voice-playback`, `.rd-voice-transcript-toggle`, and `.rd-voice-transcript`.

- [ ] **Step 1: Write failing reader integration tests**

```js
const playback = document.querySelector('[data-voice-message-id="voice-1"] .rd-voice-playback')
playback.click()
assert.equal(playback.getAttribute("aria-pressed"), "true")
playback.click()
assert.match(document.querySelector('[data-voice-message-id="voice-1"]').dataset.voiceStatus, /paused/)
```

- [ ] **Step 2: Run the integration test and verify it fails**

Run: `node --test tests/reader-phone-voice.test.mjs`

Expected: FAIL because the existing voice bubble has no semantic playback control.

- [ ] **Step 3: Replace inline transcript toggling with session playback state**

```js
chatSession.voicePlaybacks = chatSession.voicePlaybacks instanceof Map
  ? chatSession.voicePlaybacks
  : new Map()
```

Render native buttons, bind play/pause/replay and transcript disclosure, advance the active state from one local interval, and reset the active state from `returnToChatList()`, `openCallScene()`, `renderChat()`, and `openReaderApp()`.

- [ ] **Step 4: Run reader integration and existing chat tests**

Run: `node --test tests/reader-phone-voice.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-critical-flow.test.mjs`

Expected: PASS.

### Task 3: Shared visual treatment and author preview parity

**Files:**
- Modify: `css/phone-chat.css`
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: the reader voice-control markup from Task 2.
- Produces: shared waveform, active-bar, timer, transcript, focus, coarse-pointer, and reduced-motion styles; author preview uses the same component vocabulary.

- [ ] **Step 1: Add failing source and rendered-preview assertions**

```js
assert.match(phoneChatCss, /\.rd-voice-bar\.is-active/)
assert.match(phoneChatCss, /prefers-reduced-motion/)
assert.ok(shell.querySelector(".rd-voice-playback"))
```

- [ ] **Step 2: Run the author preview test and verify it fails**

Run: `node --test tests/phone-message-editor.test.mjs`

Expected: FAIL because the author preview still renders the legacy inline-toggle bubble.

- [ ] **Step 3: Add the shared voice component styles and preview markup**

Use currentColor for waveform contrast, tabular numerals for the countdown, a separate transcript action, visible focus, 44px coarse-pointer targets, and transition removal under reduced motion.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/reader-voice-playback-model.test.mjs tests/reader-phone-voice.test.mjs tests/phone-message-editor.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: production build succeeds.
