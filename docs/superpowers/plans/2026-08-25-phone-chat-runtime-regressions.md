# Phone Chat Runtime Regressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or execute each task test-first in this session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix missing non-silent reader reply bubbles and honor explicit per-message timing in chats without changing legacy static-history behavior.

**Architecture:** Keep `choice.text`, `choice.replyText`, `choice.silent`, `message.revealMode`, and `message.delayBeforeMs` storage shapes unchanged. Repair the choice contract at both author-save and shared-runtime boundaries, then let unsequenced chats opt into the existing playback scheduler only from the first explicitly paced authored message onward; retain completed paced messages in the in-memory chat session so navigation resumes rather than replays.

**Tech Stack:** Vanilla JavaScript ES modules, JSDOM, Node test runner, Vite build verification.

## Global Constraints

- Existing works with no positive `delayBeforeMs` or explicit streamed `revealMode` remain immediate static chat history.
- Only `silent:true` suppresses a reader reply; non-silent legacy choices fall back from blank `replyText` to `choice.text`.
- Images remain higher priority than text replies.
- Reuse the existing ordered playback timer, absolute deadline, stream renderer, action gate, and choice gate.
- Do not change persisted work or reader-progress schemas.
- Preserve unrelated untracked plans and artifacts; do not commit or push without a separate request.

---

### Task 1: Restore the non-silent reader reply contract

**Files:**

- Modify: `js/chat-choice-runtime.js`
- Modify: `js/pages/phone.js`
- Modify: `tests/chat-choice-runtime.test.mjs`
- Modify: `tests/phone-message-editor.test.mjs`
- Modify: `tests/reader-chat-choice-runtime.test.mjs`

**Interfaces:**

- Consumes: `choice.text`, `choice.replyText`, `choice.imageUrl`, and `choice.silent`.
- Produces: one generated self message for every non-silent text/image choice and preserves `run.replyMessageId`.

- [x] **Step 1: Add failing shared-runtime coverage**

```js
test("a legacy non-silent blank reply falls back to its visible option text", () => {
  const round = fixtureRound()
  const choice = round.messages[1].choices[1]
  choice.silent = false
  choice.replyText = ""
  choice.text = "Stay quiet"
  const result = callApply(round, "owner", 1, { idFactory: () => "reader-reply" })
  assert.equal(result.round.messages[2].senderId, "self")
  assert.equal(result.round.messages[2].text, "Stay quiet")
  assert.equal(result.run.replyMessageId, "reader-reply")
})
```

Keep the no-bubble assertion on an explicitly `silent:true` choice.

- [x] **Step 2: Run the focused test and confirm the fallback case fails**

Run: `node --test tests/chat-choice-runtime.test.mjs`

Expected: the new case fails because `applyChatChoice` currently generates no reply for an empty `replyText`.

- [x] **Step 3: Add the compatibility fallback at the shared runtime boundary**

```js
const replyText = typeof choice.replyText === "string" && choice.replyText.trim()
  ? choice.replyText
  : (typeof choice.text === "string" ? choice.text.trim() : "")

if (choice.silent !== true && replyImage) {
  // Existing image branch.
} else if (choice.silent !== true && replyText) {
  // Generate the existing self text message with `text: replyText`.
}
```

- [x] **Step 4: Add failing author-editor coverage**

Create a message choice whose visible text is `同意`, leave its send-content field blank, leave `沉默` unchecked, save, and assert `replyText === "同意"` and `silent` is absent.

- [x] **Step 5: Align author save behavior with its visible copy**

Remove `preserveEmptyReplyText:true` from the chat-message call to `openThreadReplyChoiceEditor`; the shared editor already falls back to option text unless the explicit silent checkbox is selected.

- [x] **Step 6: Add a reader integration regression**

Seed legacy data `{ text:"同意", replyText:"", followUpMessages:[] }`, click the option, and assert a `.rd-chat-message.is-self` bubble containing `同意` appears and remains after leaving and reopening the chat.

- [x] **Step 7: Run all reply-focused tests**

Run: `node --test tests/chat-choice-runtime.test.mjs tests/phone-message-editor.test.mjs tests/reader-chat-choice-runtime.test.mjs`

Expected: all tests pass with explicit silent choices still producing no reader bubble.

### Task 2: Pace explicitly authored messages without global reading flow

**Files:**

- Modify: `js/chat-playback-state.js`
- Modify: `reader/reader.js`
- Modify: `tests/chat-playback-state.test.mjs`
- Modify: `tests/reader-chat-choice-runtime.test.mjs`

**Interfaces:**

- Produces: `chatAuthoredPlaybackMessageIds(messages, completedIds)` returning the ordered suffix beginning at the first incomplete message with a positive delay or an explicitly streamed reveal mode.
- Consumes: the existing `chatSession.flowGeneratedPlayback`, `flowTypedMessageIds`, `flowAdvanceDeadline`, `chatPlaybackInitialDelayMs`, and `scheduleNextChatFlowMessage` machinery.

- [x] **Step 1: Add failing pure planning tests**

```js
assert.deepEqual(chatAuthoredPlaybackMessageIds([
  { id:"history", text:"old" },
  { id:"paced", text:"new", delayBeforeMs:3000, revealMode:"instant" },
  { id:"after", text:"later" },
]), ["paced", "after"])

assert.deepEqual(chatAuthoredPlaybackMessageIds([
  { id:"history-a", text:"old" },
  { id:"history-b", text:"also old" },
]), [])
```

Also assert completed IDs are skipped and own-property checks do not treat normalized legacy defaults as explicit authoring.

- [x] **Step 2: Run the pure test and confirm the export is missing**

Run: `node --test tests/chat-playback-state.test.mjs`

Expected: failure because the planner does not yet exist.

- [x] **Step 3: Implement the pure planner**

```js
export function chatAuthoredPlaybackMessageIds(messages, completedIds = new Set()) {
  const source = Array.isArray(messages) ? messages : []
  const completed = completedIds instanceof Set ? completedIds : new Set(completedIds || [])
  const start = source.findIndex(message => (
    message?.id != null
    && !completed.has(String(message.id))
    && (
      (Object.hasOwn(message, "delayBeforeMs") && chatMessageDelayBeforeMs(message, 0) > 0)
      || (Object.hasOwn(message, "revealMode") && normalizeChatMessageRevealMode(message.revealMode) === "stream")
    )
  ))
  if (start < 0) return []
  return source.slice(start)
    .filter(message => message?.id != null && !completed.has(String(message.id)))
    .map(message => String(message.id))
}
```

- [x] **Step 4: Add the failing JSDOM timing regression**

Parameterize a single chat and group chat with no `readingFlow`: first message is legacy static history, second is `{ revealMode:"instant", delayBeforeMs:120 }`. Assert the first is immediately present, the second is absent immediately and at 70 ms, then present by 250 ms without `.rd-flow-stream-text`.

Add a legacy control where neither message owns a timing field and both remain immediately visible.

- [x] **Step 5: Start an authored playback queue from the unsequenced visible suffix**

After IDs are normalized and saved choices hydrate, derive the currently eligible authored messages in round order. If no global flow and no active choice playback exists, call `chatAuthoredPlaybackMessageIds`; when it returns IDs, store them in `chatSession.flowGeneratedPlayback` with an `authoredPlayback:true` marker and `index` based on `chatPlaybackInitialDelayMs`.

Initialize and retain `chatSession.authoredPlaybackCompletedIds` as a `Set`. When an authored playback target completes, add its ID. Reconcile every opened chat when story selections change: clear authored completion or an active queue only when its message actually becomes invisible. This makes a rolled-back conditional message wait again when re-unlocked without replaying an OR condition that stayed visible throughout.

- [x] **Step 6: Gate the waiting authored suffix before its first timer fires**

In `flowVisibleMessageIds`, when an unsequenced playback has `index < 0` and the scan encounters its first queued ID, activate the existing playback gate before continuing. This keeps the target and every later authored message hidden until the absolute deadline expires.

- [x] **Step 7: Reuse the current scheduler and verify navigation behavior**

Do not create a second timer implementation. Let `startCurrentChatFlowMessage`, `scheduleNextChatFlowMessage`, text streaming, action completion, and `flowAdvanceDeadline` advance the authored queue. Add assertions that leaving during the wait and reopening honors the remaining deadline, and that reopening after completion shows history immediately.

- [x] **Step 8: Run all playback-focused tests**

Run: `node --test tests/chat-playback-state.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-phone-story-events.test.mjs`

Expected: explicit unsequenced timing works; legacy static history, reading flow, and choice continuations remain passing.

### Task 3: Close the reported round-condition and release gaps

**Files:**

- Modify: `tests/reader-chat-choice-runtime.test.mjs`
- Verify: `reader/reader.js`
- Verify: `js/pages/phone.js`

**Interfaces:**

- Consumes: the author-produced `displayCondition.all[].anyChoiceIds` shape.
- Produces: exact integration evidence for `endRound` plus second-round compound display conditions.

- [x] **Step 1: Strengthen the existing end-round regression**

Change at least one second-round target from legacy `visibleAfterChoiceId:"choice-a"` to:

```js
displayCondition: {
  all: [{ anyChoiceIds:["choice-a"] }],
}
```

Keep the assertions that current-round tail messages remain hidden, the matching next round appears after branch playback, and the other branch remains absent.

- [x] **Step 2: Run the full phone runtime verification**

Run: `node --test tests/chat-choice-runtime.test.mjs tests/chat-playback-state.test.mjs tests/phone-story-state.test.mjs tests/phone-message-editor.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-phone-story-events.test.mjs tests/resources-page.test.mjs`

Expected: zero failures.

- [x] **Step 3: Run the complete repository gate**

Run: `npm run verify`

Expected: all Node tests pass and `build:verify` exits with code 0.

- [x] **Step 4: Rebuild the distributable and inspect release state**

Run: `npm run build`

Then run: `git diff --check`, `git status --short --branch`, and `git rev-list --left-right --count origin/master...HEAD`.

Expected: the build exits 0; only the plan and intended source/tests differ; the final handoff explicitly notes that `origin/master` and any old `dist`/cached deployment do not contain the repaired runtime until the branch is integrated and released.
