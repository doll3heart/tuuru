# Chat Cross-App Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authored chat messages link to real phone-App content, support correct rich-message quotes, optionally block the reading flow until a card action is completed, and return readers to the exact source message.

**Architecture:** Add one pure message-link/action model shared by author and reader code. Keep author controls inside the existing message modal and context menu; keep reader navigation inside the existing phone-App layer history, carrying a bounded return-position object instead of mutating authored work.

**Tech Stack:** Vanilla JavaScript ES modules, DOM/JSDOM, Node test runner, Vite, existing Tuuru phone reader and author editor.

## Global Constraints

- Do not add a new top-level author or reader entry.
- Preserve legacy `forumPostId`, `quoteId`, and message-card data.
- Do not change reading-flow option positioning.
- Do not use AI, external APIs, or system speech.
- Do not commit or push without a separate user request.

---

### Task 1: Shared link, quote, and action model

**Files:**
- Create: `js/chat-message-actions.js`
- Create: `tests/chat-message-actions.test.mjs`

**Interfaces:**
- Produces: `listChatAppTargets(phoneData)`, `normalizeChatAppTarget(message)`, `chatMessageQuoteSummary(message)`, `messageActionLabel(message, completed)`, `messageRequiresAction(message)`.
- Consumes: existing phone collections and legacy `forumPostId`.

- [ ] **Step 1: Write failing model tests**

```js
assert.deepEqual(listChatAppTargets(phoneData).map(item => item.appType), ["forum", "memo", "shopping", "contacts"])
assert.deepEqual(normalizeChatAppTarget({ forumPostId:"post-1" }), { appType:"forum", itemId:"post-1", contactId:"" })
assert.equal(chatMessageQuoteSummary({ type:"file", fileName:"线索.pdf" }), "文件：线索.pdf")
assert.equal(messageRequiresAction({ type:"location", actionRequired:true }), true)
```

- [ ] **Step 2: Run the model test and confirm it fails**

Run: `node --test tests/chat-message-actions.test.mjs`

Expected: FAIL because `js/chat-message-actions.js` does not exist.

- [ ] **Step 3: Implement bounded target discovery and labels**

```js
export function normalizeChatAppTarget(message) {
  const appType = text(message?.targetApp) || (text(message?.forumPostId) ? "forum" : "")
  return { appType, itemId:text(message?.targetItemId || message?.forumPostId), contactId:text(message?.targetContactId) }
}
```

Target discovery must expose forum posts, memos, shopping items, gallery photos, browser history, and contacts with stable IDs and concise labels. Quote summaries must cover text, image, link, payment cards, calls, voice, every story card, and system events.

- [ ] **Step 4: Run the model test**

Run: `node --test tests/chat-message-actions.test.mjs`

Expected: PASS.

### Task 2: Author editing and preview

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-message-editor.test.mjs`
- Modify: `tests/author-content-editability.test.mjs`

**Interfaces:**
- Consumes: Task 1 target discovery, target normalization, and quote summaries.
- Produces: message fields `targetApp`, `targetItemId`, `targetContactId`, `actionRequired`, `quoteId`, `quoteText`, and `quoteSenderName`.

- [ ] **Step 1: Add failing author tests**

```js
assert.ok(editor.querySelector("#amAppTarget"))
assert.equal(saved.targetApp, "memo")
assert.equal(saved.targetItemId, "memo-1")
assert.equal(saved.actionRequired, true)
assert.equal(quoted.senderId, "self")
assert.equal(quoted.quoteText, "文件：线索.pdf")
```

- [ ] **Step 2: Run focused author tests and confirm failure**

Run: `node --test tests/phone-message-editor.test.mjs tests/author-content-editability.test.mjs`

Expected: FAIL on the new controls or fields.

- [ ] **Step 3: Upgrade the existing link modal and context-menu quote**

Add an “作品内内容” selector above the external URL field. Preserve a hidden legacy `#amForumPost` control for old data/tests, disable the external URL when an internal target is selected, and append an “仅展示 / 需要读者处理后继续” selector to actionable cards. Quote replies choose the current speaker, store the quoted sender name, and use a shared semantic summary.

- [ ] **Step 4: Render author previews with shared quote and action components**

```html
<button class="chat-quote-preview" data-quote-target="message-id">
  <span>林晚</span><strong>文件：线索.pdf</strong>
</button>
```

Use classes instead of inline quote styles and show “需查看 / 需领取 / 需回应” only when required.

- [ ] **Step 5: Run focused author tests**

Run: `node --test tests/phone-message-editor.test.mjs tests/author-content-editability.test.mjs`

Expected: PASS.

### Task 3: Reader deep links and precise return

**Files:**
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`
- Create: `tests/reader-phone-cross-app.test.mjs`

**Interfaces:**
- Consumes: Task 1 normalized App targets.
- Produces: chat-origin navigation context `{ chatId, messageId, scrollTop, anchorOffset, targetApp, targetItemId, targetContactId }`.

- [ ] **Step 1: Add failing deep-link tests**

```js
card.click()
assert.ok(document.querySelector('[data-memo-id="memo-1"].is-deep-link-target'))
document.querySelector(".rd-back-btn").click()
assert.ok(document.querySelector('[data-message-id="link-1"].is-return-target'))
```

Cover memo, forum detail, shopping order, and contact targets.

- [ ] **Step 2: Run the reader test and confirm failure**

Run: `node --test tests/reader-phone-cross-app.test.mjs`

Expected: FAIL because cards do not open linked Apps.

- [ ] **Step 3: Carry navigation context through the existing App layer**

Extend `openReaderApp` and `openReaderForumPost` with an optional internal navigation context. On back, close the current App/detail layer and reopen Messages with `_readerPendingReadingPosition` anchored to the source message. Apply one quiet highlight to both the linked target and returned source.

- [ ] **Step 4: Bind all internal cards**

Legacy forum links and new App links must use the same route. Unsafe or missing targets stay inert and show a readable unavailable state instead of leaving the phone.

- [ ] **Step 5: Run reader deep-link tests**

Run: `node --test tests/reader-phone-cross-app.test.mjs`

Expected: PASS.

### Task 4: Required card actions and flow gating

**Files:**
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`
- Modify: `tests/reader-phone-cross-app.test.mjs`
- Modify: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Consumes: Task 1 action labels and author field `actionRequired`.
- Produces: session-only `completedActionIds` and a flow wait state that never mutates imported work.

- [ ] **Step 1: Add failing completion and flow tests**

```js
assert.match(requiredCard.textContent, /需查看/)
await waitPastNormalFlowDelay()
assert.equal(nextMessageVisible(), false)
requiredCard.click()
assert.match(returnedCard.textContent, /已查看/)
assert.equal(nextMessageEventuallyVisible(), true)
```

- [ ] **Step 2: Run the focused reader tests and confirm failure**

Run: `node --test tests/reader-phone-cross-app.test.mjs tests/reader-critical-flow.test.mjs`

Expected: FAIL because required cards do not gate flow.

- [ ] **Step 3: Record completion for every supported interaction**

Opening an App/detail marks view/open actions complete; benefit buttons mark claim actions complete; schedule/friend actions mark response actions complete. Show the completed label on rerender and keep state scoped to the reader session.

- [ ] **Step 4: Gate only the current authored flow message**

The current flow step may finish typing/rendering but must not schedule the next step while `actionRequired` is true and its message ID is absent from `completedActionIds`. Completing the action rerenders and resumes the normal 800ms advancement.

- [ ] **Step 5: Run focused flow tests**

Run: `node --test tests/reader-phone-cross-app.test.mjs tests/reader-critical-flow.test.mjs`

Expected: PASS.

### Task 5: Quote navigation, visual QA, and regression

**Files:**
- Modify: `reader/reader.js`
- Modify: `css/phone-chat.css`
- Modify: `tests/phone-visual-foundation.test.mjs`
- Modify: `tests/reader-phone-cross-app.test.mjs`

**Interfaces:**
- Consumes: Task 1 quote summaries and existing `data-message-id`.
- Produces: accessible `.chat-quote-preview`, original-message focus, and reduced-motion target feedback.

- [ ] **Step 1: Add quote navigation and visual-contract tests**

```js
quote.click()
assert.equal(original.classList.contains("is-quote-target"), true)
assert.match(css, /prefers-reduced-motion/)
```

- [ ] **Step 2: Implement reader quote focus**

Quoted previews are real buttons. Clicking one scrolls the message area to the original message, focuses it without moving to another App, and applies a short non-layout highlight. Missing originals remain readable and non-interactive.

- [ ] **Step 3: Run all relevant tests**

Run:

```text
node --test tests/chat-message-actions.test.mjs tests/phone-message-editor.test.mjs tests/author-content-editability.test.mjs tests/reader-phone-cross-app.test.mjs tests/reader-phone-story-events.test.mjs tests/reader-critical-flow.test.mjs tests/phone-visual-foundation.test.mjs
```

Expected: all tests pass.

- [ ] **Step 4: Run production verification**

Run: `npm run build`

Expected: TypeScript and Vite build exit 0.

Run: `git diff --check`

Expected: exit 0, allowing only line-ending warnings.
