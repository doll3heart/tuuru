# Mobile Phone Fullscreen and Flow Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the author and reader phone fill bounded mobile viewports, and turn author-flow cues into content-preview notifications that open the exact target.

**Architecture:** Keep desktop phone geometry unchanged and extend the existing bounded mobile media queries. Enrich the existing `readerPhoneFlowNotificationHtml` renderer instead of adding another notification system, using the already-resolved flow target and the same App/contact data that renders the phone.

**Tech Stack:** Vanilla JavaScript, CSS media queries, JSDOM tests, Node test runner.

## Global Constraints

- On mobile, both author and reader phone frames consume all available width and height without a decorative outer frame.
- Message flow notifications use the matching single-contact avatar or group avatar; only their fallback uses a name initial.
- Non-message notifications use the matching authored or reader-custom App icon.
- Clicking the notification continues to use the existing flow-step-aware App opener so it reaches the exact authored item.
- Desktop phone sizing and App arrangement behavior remain unchanged.

---

### Task 1: Bounded Mobile Fullscreen Phone

**Files:**
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Test: `tests/phone-editor-viewport.test.mjs`
- Test: `tests/reader-mobile-viewport.test.mjs`

**Interfaces:**
- Consumes: existing `.phone-editor-wrap`, `.phone-reader`, and `.rd-pm-phone-wrap` bounded media rules.
- Produces: edge-to-edge mobile phone frames with `max-width:none`, `max-height:none`, `border:0`, `border-radius:0`, and `box-shadow:none`.

- [ ] **Step 1: Write the failing CSS contract tests**

```js
assert.match(wrap, /padding\s*:\s*0/)
assert.match(frame, /max-width\s*:\s*none/)
assert.match(frame, /max-height\s*:\s*none/)
assert.match(frame, /border\s*:\s*0/)
assert.match(frame, /border-radius\s*:\s*0/)
assert.match(frame, /box-shadow\s*:\s*none/)
```

- [ ] **Step 2: Run the viewport tests and confirm failure**

Run: `node --test tests/phone-editor-viewport.test.mjs tests/reader-mobile-viewport.test.mjs`

Expected: FAIL because the current author frame keeps `max-width:360px`/`max-height:680px`, and the reader frame still keeps `max-width:360px`.

- [ ] **Step 3: Add bounded edge-to-edge CSS**

```css
.phone-editor-wrap {
  padding: 0;
}
.phone-editor-wrap > .phone-frame {
  width: 100%;
  max-width: none;
  max-height: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
```

Apply equivalent width and chrome removal rules to `.phone-reader > .phone-frame` and `.rd-pm-phone-wrap`.

- [ ] **Step 4: Run the viewport tests**

Run: `node --test tests/phone-editor-viewport.test.mjs tests/reader-mobile-viewport.test.mjs`

Expected: PASS.

### Task 2: Content-Aware Flow Notification

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Consumes: `resolvePhoneReadingFlowStep(phoneData, step)`, `readerAppName(app)`, `readerCustomIconUrl(value)`, App metadata, contacts, chats, and resolved flow items.
- Produces: `readerPhoneFlowNotificationHtml(phoneData, step, custom)` with `.is-contact-avatar` for Messages and `.is-app-icon` for every other App.

- [ ] **Step 1: Write failing notification-content tests**

```js
const contact = work.phoneData.contacts[0]
contact.avatarUrl = "data:image/png;base64,avatar"
const notification = document.querySelector(".phone-flow-notification")
assert.equal(notification.querySelector(".phone-flow-notification-icon img")?.src, contact.avatarUrl)
assert.match(notification.textContent, /第一项消息/)
```

For memo, assert that the notification has `.is-app-icon`, includes the App icon, and previews `第三项备忘录`.

- [ ] **Step 2: Run the critical-flow tests and confirm failure**

Run: `node --test tests/reader-critical-flow.test.mjs`

Expected: FAIL because Messages currently renders the Messages App icon and generic “有一段新对话”.

- [ ] **Step 3: Implement target-specific visual and preview resolution**

```js
var isMessage = step.type === 'messages' && target.chat
var visualUrl = isMessage
  ? (target.chat.type === 'group' ? target.chat.groupAvatarUrl : contact && contact.avatarUrl)
  : readerCustomIconUrl(custom.customIcons && custom.customIcons[appType])
var preview = isMessage
  ? readerPhoneFlowMessagePreview(target.message)
  : readerPhoneFlowItemPreview(step.type, target.item)
```

Render an image when `visualUrl` exists; otherwise render the contact/group initial for Messages and the sanitized App icon for other modules.

- [ ] **Step 4: Refine the existing banner CSS**

Use a 42px visual, two-line preview, 12px side margins, 12–13px radius, and a maximum 8px shadow blur. Keep a visible focus outline, a short state-change entrance, and the existing reduced-motion override.

- [ ] **Step 5: Run the critical-flow tests**

Run: `node --test tests/reader-critical-flow.test.mjs`

Expected: PASS.

### Task 3: Integrated Verification

**Files:**
- Test: `tests/phone-editor-viewport.test.mjs`
- Test: `tests/reader-mobile-viewport.test.mjs`
- Test: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Consumes: the completed CSS and notification renderer.
- Produces: verified responsive and flow behavior.

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/phone-editor-viewport.test.mjs tests/reader-mobile-viewport.test.mjs tests/reader-critical-flow.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run the reader suite and production build**

Run:

```powershell
$readerTests = (Get-ChildItem -LiteralPath 'tests' -Filter 'reader-*.test.mjs').FullName
node --test @readerTests
npm run build:verify
```

Expected: all reader tests pass and both production builds complete successfully.

- [ ] **Step 3: Verify the real mobile page**

At `390×844`, verify author phone edge-to-edge, reader phone edge-to-edge, notification avatar/App-icon selection, two-line preview, and direct navigation to the selected flow item.

