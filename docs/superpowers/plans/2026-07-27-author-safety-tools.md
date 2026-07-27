# Author Safety Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a work-size report, deletion impact previews, bulk phone timestamp shifting, and one-step undo for bulk home-page mutations.

**Architecture:** Each feature gets a pure data module with deterministic tests. Home-page mutations continue through the existing edit-session and atomic database commit boundary; editor deletion warnings remain read-only until the author confirms. Bulk undo stores one in-memory snapshot and restores it only when the current work token still matches the completed bulk operation.

**Tech Stack:** Browser-native ES modules, DOM APIs, Web Crypto package sizing constants, Node test runner, Vite.

## Global Constraints

- No external API, AI service, upload, or network request.
- Never rewrite identifiers, URLs, branch targets, or reader state as a side effect.
- Treat 1.5 MiB as caution and 2 MiB as high persistence risk, not a universal browser hard limit.
- Every mutation must preview its exact scope and reject stale work tokens.
- Bulk undo must never overwrite edits made after the bulk operation.

---

### Task 1: Work size report

**Files:**
- Create: `js/work-size-report.js`
- Modify: `js/pages/home-preflight.js`
- Modify: `css/styles.css`
- Test: `tests/work-size-report.test.mjs`
- Test: `tests/work-preflight-ui.test.mjs`

**Interfaces:**
- Produces: `inspectWorkSize(work)` returning package bytes, risk level, embedded asset totals, and locators.
- Consumes: `renderWorkPreflightBody()` and the existing article/phone navigation helpers.

- [ ] **Step 1: Write failing model tests**

```js
import { inspectWorkSize } from "../js/work-size-report.js"

const report = inspectWorkSize({
  id:"work-1",
  nodes:[{id:"node-1", content:`<img src="data:image/png;base64,${Buffer.alloc(32).toString("base64")}">`}],
})
assert.equal(report.assets.length, 1)
assert.equal(report.assets[0].locator.nodeId, "node-1")
assert.ok(report.encryptedPackageBytes > report.plaintextBytes)
```

- [ ] **Step 2: Run the focused tests and confirm the missing module failure**

Run: `node --test tests/work-size-report.test.mjs`

Expected: FAIL because `js/work-size-report.js` does not exist.

- [ ] **Step 3: Implement exact package sizing and data-URL accounting**

```js
export function inspectWorkSize(work) {
  const serialized = JSON.stringify(work)
  const plaintextBytes = new TextEncoder().encode(serialized).length
  return {
    plaintextBytes,
    encryptedPackageBytes: plaintextBytes + 35,
    risk: plaintextBytes >= 2 * 1024 * 1024 ? "high" : plaintextBytes >= 1.5 * 1024 * 1024 ? "caution" : "safe",
    assets: collectEmbeddedAssets(work),
  }
}
```

- [ ] **Step 4: Add the report to publish preflight**

Render the total, risk explanation, top embedded assets, and a “去处理” button. Article assets write `nodeId` to `article-editor-view-state`; phone assets navigate to the phone editor; work-watermark assets open “作品信息”.

- [ ] **Step 5: Run model and UI tests**

Run: `node --test tests/work-size-report.test.mjs tests/work-preflight-ui.test.mjs`

Expected: PASS.

### Task 2: Deletion impact preview

**Files:**
- Create: `js/work-references.js`
- Modify: `js/pages/editor.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/work-references.test.mjs`
- Test: `tests/deletion-impact-ui.test.mjs`

**Interfaces:**
- Produces: `findWorkReferences(work, { kind, id })` for `node`, `choice`, `contact`, and `npc`.
- Produces: reference records `{ id, category, location, sourceNodeId?, appType? }`.
- Consumes: article node/choice deletion and phone contact/NPC deletion handlers.

- [ ] **Step 1: Write failing reference tests**

```js
assert.deepEqual(
  findWorkReferences(work, {kind:"choice", id:"choice-1"}).map(item => item.category),
  ["显示条件"],
)
assert.ok(findWorkReferences(work, {kind:"contact", id:"contact-1"}).some(item => item.category === "消息"))
```

- [ ] **Step 2: Run tests and confirm the missing export failure**

Run: `node --test tests/work-references.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement allowlisted reference traversal**

Scan article choice targets, interactive-scene continuations, phone modules, hidden-node conditions, chat members/senders, moments, forum content, memos, gallery, browser, shopping, and forum NPC authors. Never use a generic “matching string means reference” rule.

- [ ] **Step 4: Add impact dialogs to destructive controls**

Show the count and concrete locations before confirmation. Article reference rows can jump to their source node; phone rows can open the corresponding App surface. A deletion with no references retains the compact confirmation.

- [ ] **Step 5: Run model and UI tests**

Run: `node --test tests/work-references.test.mjs tests/deletion-impact-ui.test.mjs`

Expected: PASS.

### Task 3: Bulk phone timestamp shifting

**Files:**
- Create: `js/work-time-shift.js`
- Create: `js/pages/home-time-shift.js`
- Modify: `js/home-work-mutations.js`
- Modify: `js/pages/home.js`
- Modify: `css/styles.css`
- Modify: `tests/home-work-mutations.test.mjs`
- Test: `tests/work-time-shift.test.mjs`
- Test: `tests/home-time-shift-ui.test.mjs`

**Interfaces:**
- Produces: `findPhoneTimeEntries(work)` and `shiftPhoneTimes(work, options)`.
- Produces: `shiftHomeWorkTimes(args, dependencies)` through the guarded home mutation boundary.
- Consumes: work-card “批量顺延时间” dialog with per-entry selection.

- [ ] **Step 1: Write failing parsing and immutable-shift tests**

```js
const preview = findPhoneTimeEntries(work)
assert.equal(preview.matches[0].value, "2026/7/22 21:30")
const shifted = shiftPhoneTimes(work, {offsetMinutes:90, selectedMatchIds:[preview.matches[0].id]})
assert.equal(shifted.work.phoneData.moments[0].time, "2026/7/22 23:00")
assert.equal(work.phoneData.moments[0].time, "2026/7/22 21:30")
```

- [ ] **Step 2: Run tests and confirm missing module/export failures**

Run: `node --test tests/work-time-shift.test.mjs tests/home-work-mutations.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement format-preserving supported timestamps**

Support `YYYY/M/D HH:mm[:ss]`, `YYYY-M-D HH:mm[:ss]`, `YYYY年M月D日 HH:mm[:ss]`, and `HH:mm[:ss]`. Report relative/free-form labels as skipped and never guess their meaning.

- [ ] **Step 4: Implement guarded write and preview dialog**

The dialog accepts days/hours/minutes, previews new values, allows individual selection, and disables confirmation for zero offsets or empty selections.

- [ ] **Step 5: Run focused model, mutation, and UI tests**

Run: `node --test tests/work-time-shift.test.mjs tests/home-work-mutations.test.mjs tests/home-time-shift-ui.test.mjs`

Expected: PASS.

### Task 4: One-step bulk undo

**Files:**
- Create: `js/home-bulk-undo.js`
- Modify: `js/home-work-mutations.js`
- Modify: `js/pages/home.js`
- Modify: `css/styles.css`
- Modify: `tests/home-work-mutations.test.mjs`
- Test: `tests/home-bulk-undo.test.mjs`
- Modify: `tests/home-find-replace-ui.test.mjs`
- Modify: `tests/home-time-shift-ui.test.mjs`

**Interfaces:**
- Produces: `createHomeBulkUndoStore()` with `register`, `peek`, `consume`, and `clear`.
- Produces: `restoreHomeWorkSnapshot(args, dependencies)` guarded by `expectedWorkToken`.
- Consumes: successful full-work replacement and timestamp shifting.

- [ ] **Step 1: Write failing store and guarded-restore tests**

```js
store.register({workId:"work-1", label:"全作品查找替换", beforeWork, expectedWorkToken:"after"})
assert.equal(store.peek("work-1").label, "全作品查找替换")
store.consume("work-1")
assert.equal(store.peek("work-1"), null)
```

- [ ] **Step 2: Run tests and confirm missing module/export failures**

Run: `node --test tests/home-bulk-undo.test.mjs tests/home-work-mutations.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement one in-memory undo record and atomic restoration**

Clone snapshots on input/output. Restore only when the current work token equals the post-operation token, keep the original work id, and refresh `updatedAt`. Consume the undo record only after verified success.

- [ ] **Step 4: Wire bulk operations and the work-card undo action**

Capture the pre-operation work immediately before replace/shift. After success, show “撤销上次批量操作” on that work card; hide it after undo or after a conflicting operation.

- [ ] **Step 5: Run the full verification**

Run: `npm run verify`

Expected: all Node tests pass, TypeScript build passes, and Vite production builds succeed.
