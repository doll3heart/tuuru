# Chat Choice Gates And Follow-up Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make message reply choices unlock the conversation in order, cascade rollback when an earlier answer is reselected, and let each authored character follow-up define its own delivery state and reply pace.

**Architecture:** Keep authored chat data immutable in the reader session. Derive a visible message prefix from the first unresolved choice gate, keep generated messages attached to stable choice runs, and remove the selected run plus every later run during reselection. Extend follow-up templates with optional `deliveryState` and `replyPace` fields; the runtime converts those fields into the existing failed-message and recall-event presentation formats.

**Tech Stack:** Vanilla JavaScript ES modules, JSDOM integration tests, Node test runner, existing Tuuru modal/form controls and reader chat renderer.

## Global Constraints

- Existing works without follow-up-level settings must inherit the choice-level reply pace and render as normal messages.
- A chat with no reply choices must retain its current all-messages-visible behavior.
- Reader choices and generated messages remain session-only and must not mutate the authored work.
- All new selects and remove controls must remain keyboard accessible and usable on narrow phone layouts.
- Do not commit, push, or deploy without a separate user request.

---

### Task 1: Ordered Choice Gates And Cascading Rollback

**Files:**
- Modify: `tests/reader-chat-choice-runtime.test.mjs`
- Modify: `reader/reader.js`

**Interfaces:**
- Consumes: `choiceRuns: Map<string, { roundIndex, run }>` and `rollbackChatChoice(round, run)`.
- Produces: non-flow `visibleMessageIds` containing only the authored/generated prefix through the first unresolved owner, and a reselection path that removes the target run plus later runs.

- [ ] **Step 1: Write the failing integration assertions**

Extend the existing two-owner fixture to assert the second question is absent initially, appears after the first selection, and disappears together with its selected reply after reselecting the first answer.

```js
assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
// choose first
assert.match(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
// choose second, then reselect first
assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /Second reader reply/)
assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/reader-chat-choice-runtime.test.mjs`

Expected: the initial second-question assertion and downstream rollback assertion fail against the current reader.

- [ ] **Step 3: Gate the non-flow visible prefix**

In `flowVisibleMessageIds()`, scan current round messages in authored order. Add each message to a `Set`; stop after the active generated playback item or after the first choice owner without a matching run. Preserve the existing reading-flow path unchanged.

```js
var visible = new Set()
messageScan:
for (var roundIndex = 0; roundIndex < ch.rounds.length; roundIndex++) {
  var messages = ch.rounds[roundIndex].messages || []
  for (var messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    var message = messages[messageIndex]
    visible.add(String(message.id))
    if (activePlaybackId && String(message.id) === activePlaybackId) break messageScan
    if (Array.isArray(message.choices) && message.choices.length > 0
      && !choiceRuns.has(choiceRunKey(roundIndex, message.id))) break messageScan
  }
}
```

- [ ] **Step 4: Cascade rollback from the selected run**

Use the insertion order of `choiceRuns`, which matches enforced selection order. Roll back entries from the selected key to the end in reverse order; clear generated IDs from playback, typing, transient, voice, claim, reaction, and event state before rerendering.

- [ ] **Step 5: Run the focused reader test**

Run: `node --test tests/reader-chat-choice-runtime.test.mjs`

Expected: all tests pass, including the new ordered-gate and cascade assertions.

### Task 2: Follow-up Delivery State And Individual Pace Runtime

**Files:**
- Create: `js/chat-follow-up.js`
- Modify: `js/chat-choice-runtime.js`
- Modify: `tests/chat-choice-runtime.test.mjs`

**Interfaces:**
- Produces: `CHAT_FOLLOW_UP_DELIVERY_STATES`, `normalizeChatFollowUpDeliveryState(value)`.
- Consumes follow-up fields: `deliveryState?: "normal" | "failed" | "recalled"`, `replyPace?: "instant" | "quick" | "normal" | "delayed"`.

- [ ] **Step 1: Write failing runtime tests**

Add a fixture where one follow-up overrides the choice default with `replyPace:"instant"`, one uses `deliveryState:"failed"`, and one uses `deliveryState:"recalled"`. Assert each non-instant character message gets its own typing event, failed output has `failed:true`, and recalled output is a `system-event` containing the original message in `recalledMessage`.

- [ ] **Step 2: Run the runtime test and verify failure**

Run: `node --test tests/chat-choice-runtime.test.mjs`

Expected: the current one-typing-event runtime and untransformed delivery fields fail the new assertions.

- [ ] **Step 3: Add delivery-state normalization**

```js
export const CHAT_FOLLOW_UP_DELIVERY_STATES = Object.freeze([
  Object.freeze({ value:"normal", label:"正常发送" }),
  Object.freeze({ value:"failed", label:"发送失败" }),
  Object.freeze({ value:"recalled", label:"发送后撤回" }),
])

export function normalizeChatFollowUpDeliveryState(value) {
  return CHAT_FOLLOW_UP_DELIVERY_STATES.some(option => option.value === value) ? value : "normal"
}
```

- [ ] **Step 4: Generate each follow-up independently**

Resolve `followUpMessage.replyPace` with `choice.replyPace` as fallback, add a typing event immediately before each paced non-reader message, strip authoring-only fields from generated bubbles, set `failed:true` for failed delivery, and build an existing-compatible recall event for recalled delivery.

- [ ] **Step 5: Run runtime tests**

Run: `node --test tests/chat-choice-runtime.test.mjs`

Expected: all runtime tests pass and existing immutable insertion/rollback behavior remains intact.

### Task 3: Author Controls For Every Character Follow-up

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: `CHAT_FOLLOW_UP_DELIVERY_STATES`, `CHAT_REPLY_PACES`, and both normalizers.
- Produces: saved follow-up templates with optional `deliveryState` and optional per-message `replyPace`; omitted pace means inherit the choice default.

- [ ] **Step 1: Write failing editor assertions**

Assert each `.thread-choice-followup-row` contains `.thread-choice-followup-delivery` and `.thread-choice-followup-pace`; saving preserves a failed state and a per-message delayed pace, while selecting inherit removes the override.

- [ ] **Step 2: Run the editor test and verify failure**

Run: `node --test tests/phone-message-editor.test.mjs`

Expected: the new controls are absent before implementation.

- [ ] **Step 3: Extend editor collection and save logic**

Read existing `failed`/recall templates into the new state for compatibility. Render standard native selects, keep the current choice-level pace as “默认节奏”, and save follow-up pace only when it is not `inherit`.

- [ ] **Step 4: Harden the responsive row layout**

Use one message-content row and one compact settings row per follow-up instead of forcing five controls into a single grid line. Keep `min-width:0`, wrapping labels, 44px coarse-pointer targets, visible focus, and a full-width mobile fallback.

- [ ] **Step 5: Run editor tests and the layout detector**

Run: `node --test tests/phone-message-editor.test.mjs`

Run: `node D:/Codex/home/skills/impeccable/scripts/detect.mjs --json --scope layout css/styles.css js/pages/phone.js`

Expected: editor tests pass and the detector returns `[]`.

### Task 4: Tutorial And End-to-end Verification

**Files:**
- Modify: `js/pages/resources.js`
- Modify: `tests/resources-page.test.mjs`
- Test: `tests/thread-choice-runtime.test.mjs`
- Test: `tests/work-schema.test.mjs`

**Interfaces:**
- Documents the ordered gate, cascading reselection, choice default pace, and follow-up-level state/pace override.

- [ ] **Step 1: Add tutorial assertions**

Require copy explaining that later messages remain hidden until the current reply is selected, reselecting an earlier answer clears later results, and each character follow-up can override status and pace.

- [ ] **Step 2: Update tutorial copy**

Amend “消息回复选项” and “回复节奏” without presenting Mini/phone messaging as a full branching engine.

- [ ] **Step 3: Run focused regression tests**

Run: `node --test tests/chat-choice-runtime.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/phone-message-editor.test.mjs tests/resources-page.test.mjs tests/thread-choice-runtime.test.mjs tests/work-schema.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 4: Verify production build and reader interaction**

Run: `npm run build`

Then use the local reader at desktop and 390px widths to verify the editor controls do not overflow and the two-gate reader fixture reveals one question at a time.

- [ ] **Step 5: Run final diff and full verification checks**

Run: `git diff --check`

Run: `npm run verify`

Expected: no whitespace errors, all tests pass, and build verification exits successfully.
