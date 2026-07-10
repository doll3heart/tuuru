# Phone Module Draft Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent article phone-module editing from ever writing temporary `phoneData` into the formal article work.

**Architecture:** Route `phone.js` work access through a compatibility adapter. Real IDs continue to use `data.js`; unique `phone-draft:` IDs use clone-isolated memory sessions. Replace timer/DOM-observer closure detection with a synchronous, vetoable close lifecycle, then commit only the selected phone module payload.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js `node:test`, Vite 6, TypeScript build validation.

## Global Constraints

- The application remains frontend-only and local-only; no server, community, remote upload, or database service is added.
- Existing work schemas and standalone phone persistence behavior remain compatible.
- No whole-file rewrite of `js/pages/phone.js`; changes use narrow compatibility seams.
- Closing with the top-right button or backdrop retains the existing save-and-close behavior.
- Each task is committed independently with a Conventional Commit message.
- Before the next task, the working tree must be clean and the full test suite plus both Vite builds must pass.
- Build validation writes to `%TEMP%`, never to tracked `dist-editor` or the workspace `dist-reader` directory.

---

### Task 1: Centralize phone work access

**Files:**
- Create: `js/phone-work-access.js`
- Create: `tests/phone-work-access.test.mjs`
- Modify: `js/pages/phone.js:2`

**Interfaces:**
- Consumes: `getWork(id)` and `updateWork(id, patch)` from `js/data.js`.
- Produces: `createPhoneWorkAccess(dependencies)`, `getPhoneWork(id)`, `updatePhoneWork(id, patch)`, and `createPhoneWorkDraft(initialWork)`.
- A draft handle is `{ id, snapshot(), dispose() }`.

- [ ] **Step 1: Write the failing access-contract tests**

```js
import test from "node:test"
import assert from "node:assert/strict"
import { createPhoneWorkAccess } from "../js/phone-work-access.js"

test("real work ids delegate to the existing data layer", () => {
  const writes = []
  const access = createPhoneWorkAccess({
    readStoredWork: id => ({ id, phoneData: { chats: [] } }),
    updateStoredWork: (id, patch) => { writes.push({ id, patch }); return { id, ...patch } },
    createSessionId: () => "one",
    now: () => 10,
  })
  assert.equal(access.getPhoneWork("work-1").id, "work-1")
  assert.deepEqual(access.updatePhoneWork("work-1", { title: "x" }), { id: "work-1", title: "x" })
  assert.deepEqual(writes, [{ id: "work-1", patch: { title: "x" } }])
})

test("draft writes never reach the formal work", () => {
  const formal = { id: "article-1", type: "article" }
  let writes = 0
  const access = createPhoneWorkAccess({
    readStoredWork: () => formal,
    updateStoredWork: () => { writes += 1 },
    createSessionId: () => "one",
    now: () => 10,
  })
  const draft = access.createPhoneWorkDraft({ ...formal, phoneData: { chats: [] } })
  access.updatePhoneWork(draft.id, { phoneData: { chats: [{ id: "chat-1" }] } })
  assert.equal(writes, 0)
  assert.equal(Object.hasOwn(formal, "phoneData"), false)
  assert.deepEqual(draft.snapshot().phoneData.chats, [{ id: "chat-1" }])
})

test("draft reads, writes, snapshots, and concurrent sessions are clone isolated", () => {
  let nextId = 0
  const access = createPhoneWorkAccess({
    readStoredWork: () => null,
    updateStoredWork: () => null,
    createSessionId: () => String(++nextId),
    now: () => 10,
  })
  const initial = { id: "article-1", phoneData: { contacts: [{ id: "c1", name: "A" }] } }
  const first = access.createPhoneWorkDraft(initial)
  const second = access.createPhoneWorkDraft(initial)
  const read = access.getPhoneWork(first.id)
  read.phoneData.contacts[0].name = "changed outside"
  assert.equal(access.getPhoneWork(first.id).phoneData.contacts[0].name, "A")
  access.updatePhoneWork(first.id, { phoneData: { contacts: [{ id: "c1", name: "B" }] } })
  const snapshot = first.snapshot()
  snapshot.phoneData.contacts[0].name = "changed snapshot"
  assert.equal(first.snapshot().phoneData.contacts[0].name, "B")
  assert.equal(second.snapshot().phoneData.contacts[0].name, "A")
})

test("disposed and unknown draft ids fail closed", () => {
  const access = createPhoneWorkAccess({
    readStoredWork: id => ({ id, leaked: true }),
    updateStoredWork: () => ({ leaked: true }),
    createSessionId: () => "one",
    now: () => 10,
  })
  const draft = access.createPhoneWorkDraft({ id: "article-1" })
  draft.dispose()
  draft.dispose()
  assert.equal(access.getPhoneWork(draft.id), null)
  assert.equal(access.updatePhoneWork(draft.id, { leaked: true }), null)
  assert.equal(access.getPhoneWork("phone-draft:missing"), null)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/phone-work-access.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/phone-work-access.js`.

- [ ] **Step 3: Implement the minimal adapter**

```js
import { getWork, updateWork } from "./data.js"

const DRAFT_PREFIX = "phone-draft:"
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))
const defaultSessionId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function createPhoneWorkAccess({
  readStoredWork,
  updateStoredWork,
  createSessionId = defaultSessionId,
  now = Date.now,
}) {
  const drafts = new Map()

  function getPhoneWork(id) {
    if (!String(id).startsWith(DRAFT_PREFIX)) return readStoredWork(id)
    const work = drafts.get(id)
    return work ? clone(work) : null
  }

  function updatePhoneWork(id, patch) {
    if (!String(id).startsWith(DRAFT_PREFIX)) return updateStoredWork(id, patch)
    const current = drafts.get(id)
    if (!current) return null
    const next = { ...current, ...clone(patch), updatedAt: now() }
    drafts.set(id, next)
    return clone(next)
  }

  function createPhoneWorkDraft(initialWork) {
    let id
    do id = DRAFT_PREFIX + createSessionId()
    while (drafts.has(id))
    const initial = { ...clone(initialWork), id }
    drafts.set(id, initial)
    let disposed = false
    return {
      id,
      snapshot() { return disposed ? null : clone(drafts.get(id)) },
      dispose() {
        if (disposed) return
        disposed = true
        drafts.delete(id)
      },
    }
  }

  return { getPhoneWork, updatePhoneWork, createPhoneWorkDraft }
}

const phoneWorkAccess = createPhoneWorkAccess({ readStoredWork: getWork, updateStoredWork: updateWork })
export const getPhoneWork = phoneWorkAccess.getPhoneWork
export const updatePhoneWork = phoneWorkAccess.updatePhoneWork
export const createPhoneWorkDraft = phoneWorkAccess.createPhoneWorkDraft
```

- [ ] **Step 4: Route `phone.js` through the adapter**

Replace its data import with two imports:

```js
import { uid, PHONE_APP_DEFS, DEFAULT_PHONE_SKIN, avatarColor, MOMO_AVATARS, USERXX_AVATARS, randomMomoName, randomUserXXName, randomAvatar } from "../data.js"
import { getPhoneWork as getWork, updatePhoneWork as updateWork } from "../phone-work-access.js"
```

- [ ] **Step 5: Verify GREEN and compatibility**

Run: `node --test tests/phone-work-access.test.mjs`

Expected: 4 tests pass.

Run: `npm test`

Expected: all repository tests pass.

- [ ] **Step 6: Build both entries outside the worktree**

Run PowerShell:

```powershell
$node=(Get-Command node.exe).Source
$vite=(Resolve-Path '.\node_modules\vite\bin\vite.js').Path
& $node $vite build --config vite.config.ts --outDir (Join-Path $env:TEMP 'tuuru-validation-editor') --emptyOutDir
& $node $vite build --config vite.reader.config.ts --outDir (Join-Path $env:TEMP 'tuuru-validation-reader') --emptyOutDir
```

Expected: both builds exit 0 and `git status --short` lists only Task 1 files.

- [ ] **Step 7: Commit**

```bash
git add js/phone-work-access.js js/pages/phone.js tests/phone-work-access.test.mjs
git commit -m "refactor(phone): centralize work access"
```

### Task 2: Make phone modal closure explicit and vetoable

**Files:**
- Create: `js/phone-modal-lifecycle.js`
- Create: `tests/phone-modal-lifecycle.test.mjs`
- Modify: `js/pages/phone.js:30-76`

**Interfaces:**
- Consumes: optional `beforeClose(reason)` and `afterClose(result, reason)` callbacks.
- Produces: `createPhoneModalCloseController({ beforeClose, remove, afterClose })` and `openPhoneAppModal(wid, appType, options = {})` returning the exact overlay element.

- [ ] **Step 1: Write failing lifecycle tests**

```js
import test from "node:test"
import assert from "node:assert/strict"
import { createPhoneModalCloseController } from "../js/phone-modal-lifecycle.js"

test("a rejected close keeps the modal open", () => {
  let removes = 0
  const close = createPhoneModalCloseController({ beforeClose: () => false, remove: () => { removes += 1 } })
  assert.equal(close("button"), false)
  assert.equal(removes, 0)
})

test("a successful close removes once and passes its result", () => {
  const events = []
  const close = createPhoneModalCloseController({
    beforeClose: reason => ({ reason, saved: true }),
    remove: () => events.push("remove"),
    afterClose: (result, reason) => events.push({ result, reason }),
  })
  assert.equal(close("backdrop"), true)
  assert.equal(close("button"), false)
  assert.deepEqual(events, ["remove", { result: { reason: "backdrop", saved: true }, reason: "backdrop" }])
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/phone-modal-lifecycle.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement and integrate the close controller**

```js
export function createPhoneModalCloseController({ beforeClose, remove, afterClose }) {
  let closed = false
  return function close(reason) {
    if (closed) return false
    const result = beforeClose ? beforeClose(reason) : undefined
    if (result === false) return false
    closed = true
    remove()
    if (afterClose) afterClose(result, reason)
    return true
  }
}
```

In `openPhoneAppModal`, default `options` to `{}`, create one controller with `remove: () => ov.remove()`, bind button/backdrop to it, and `return ov` after rendering. Existing two-argument callers therefore keep their current behavior.

- [ ] **Step 4: Verify, build, and commit**

Run: `node --test tests/phone-modal-lifecycle.test.mjs && npm test`

Run the two temporary Vite build commands from Task 1.

Expected: tests and builds exit 0; only Task 2 files differ.

```bash
git add js/phone-modal-lifecycle.js js/pages/phone.js tests/phone-modal-lifecycle.test.mjs
git commit -m "refactor(phone): make modal closure explicit"
```

### Task 3: Move article phone modules to memory drafts

**Files:**
- Create: `js/phone-module-draft.js`
- Create: `tests/phone-module-draft.test.mjs`
- Modify: `js/pages/editor.js:1260-1364`

**Interfaces:**
- Consumes: `createPhoneWorkDraft(initialWork)` from Task 1 and the modal callback options from Task 2.
- Produces: `createPhoneModuleDraftData(work, moduleData)`, `pickPhoneModuleData(type, phoneData)`, `hasPhoneModuleContent(type, data)`, and `createPhoneModuleCloseHandlers(options)`.

- [ ] **Step 1: Write failing pure-data tests**

```js
import test from "node:test"
import assert from "node:assert/strict"
import { createPhoneModuleCloseHandlers, createPhoneModuleDraftData, hasPhoneModuleContent, pickPhoneModuleData } from "../js/phone-module-draft.js"

test("building a module draft does not add phoneData to the article", () => {
  const article = { id: "article-1", type: "article" }
  const draft = createPhoneModuleDraftData(article, { chats: [{ id: "chat-1" }] })
  assert.equal(Object.hasOwn(article, "phoneData"), false)
  assert.deepEqual(draft.chats, [{ id: "chat-1" }])
  assert.deepEqual(draft.contacts, [])
})

test("module payload projection keeps the existing schema per app", () => {
  const phoneData = {
    chats: [{ id: "chat-1" }], contacts: [{ id: "contact-1" }],
    forumPosts: [{ id: "post-1" }], memos: [{ id: "memo-1" }],
    photos: [{ id: "photo-1" }], albums: [{ id: "album-1" }],
    browserHistory: [{ id: "history-1" }], shoppingItems: [{ id: "item-1" }],
  }
  assert.deepEqual(pickPhoneModuleData("messages", phoneData), { chats: phoneData.chats, contacts: phoneData.contacts })
  assert.deepEqual(pickPhoneModuleData("gallery", phoneData), { photos: phoneData.photos, albums: phoneData.albums })
  assert.deepEqual(pickPhoneModuleData("shopping", phoneData), { shoppingItems: phoneData.shoppingItems })
})

test("content detection matches each module primary collection", () => {
  assert.equal(hasPhoneModuleContent("messages", { chats: [] }), false)
  assert.equal(hasPhoneModuleContent("messages", { chats: [{ id: "chat-1" }] }), true)
  assert.equal(hasPhoneModuleContent("gallery", { photos: [], albums: [{ id: "album-1" }] }), true)
})

test("a failed formal module commit keeps the draft available", () => {
  let disposed = 0
  const errors = []
  const draft = {
    snapshot: () => ({ phoneData: { chats: [{ id: "chat-1" }], contacts: [] } }),
    dispose: () => { disposed += 1 },
  }
  const handlers = createPhoneModuleCloseHandlers({
    type: "messages",
    draft,
    commit: () => null,
    onError: error => errors.push(error),
  })
  assert.equal(handlers.beforeClose(), false)
  assert.equal(disposed, 0)
  assert.equal(errors.length, 1)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/phone-module-draft.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure draft helpers**

Use a fixed collection registry matching the current persisted module payloads. `createPhoneModuleDraftData` clones `moduleData`, copies shared contacts only when absent, and initializes every phone collection plus `skin` and `apps`. `pickPhoneModuleData` returns cloned values so a post-close callback cannot mutate the disposed draft. `hasPhoneModuleContent` checks the same primary collections as the current editor.

`createPhoneModuleCloseHandlers` returns `{ beforeClose, afterClose }`. `beforeClose` snapshots and projects the virtual draft, calls an injected formal module `commit`, and disposes only after a successful commit or an intentionally empty close. A thrown or null commit calls `onError` and returns `false` without disposing. `afterClose` sends a successful module to `onSaved` or an empty result to `onEmpty`.

- [ ] **Step 4: Replace formal temporary writes in `editor.js`**

Import `createPhoneWorkDraft`, `createPhoneModuleDraftData`, and `createPhoneModuleCloseHandlers`. In `openPhoneAppModalForCard`:

1. Build draft data without mutating `w`.
2. Create a virtual work draft from `{ ...w, phoneData: tempPd }`.
3. Call `openPhoneAppModal(draft.id, type, { beforeClose, afterClose })`.
4. In `beforeClose`, snapshot the virtual work, project `pmData`, and attempt `addPhoneModule` or `updatePhoneModule` using the real `wid`.
5. Return `false` and show an error toast if the final formal module write fails; retain the live draft.
6. On success or intentionally empty new content, dispose the draft and return `{ savedPm }`.
7. In `afterClose`, invoke the existing card callback only when `savedPm` exists.

Delete `originalPd`, every temporary `updateWork(wid, { phoneData: ... })`, the 200ms timer, `querySelector`, and `MutationObserver` from this function.

- [ ] **Step 5: Verify RED-GREEN behavior and source invariant**

Run: `node --test tests/phone-module-draft.test.mjs`

Expected: all tests pass.

Run:

```powershell
rg -n "originalPd|KEY FIX|setTimeout\(function\(\).*phone-app-modal|MutationObserver" js/pages/editor.js
```

Expected: no matches in `openPhoneAppModalForCard`.

Run: `npm test`, then the two temporary Vite builds from Task 1.

Expected: all commands exit 0 and `git status --short` lists only Task 3 files.

- [ ] **Step 6: Commit**

```bash
git add js/phone-module-draft.js js/pages/editor.js tests/phone-module-draft.test.mjs
git commit -m "fix(editor): isolate phone module drafts"
```

### Task 4: Review the completed subproject

**Files:**
- Review only; fixes, if required, are committed separately with the narrowest matching scope.

**Interfaces:**
- Consumes: the three completed task commits and their test reports.
- Produces: a clean task review and a clean whole-subproject review.

- [ ] **Step 1: Generate review packages for each task and dispatch focused reviewers**

Use the recorded base and head SHAs for each task. Reviewers verify both specification compliance and code quality, with special attention to fail-closed virtual IDs, clone isolation, exact-once closing, and the absence of formal article `phoneData` writes.

- [ ] **Step 2: Resolve every Critical or Important finding**

Send the complete finding list back to one implementer, rerun the covering tests, create a separate corrective commit, and request re-review.

- [ ] **Step 3: Run final verification**

Run `npm test`, both temporary Vite builds, and `git status --short`.

Expected: all tests pass, both builds exit 0, and the working tree is clean.
