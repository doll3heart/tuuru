# Local Save Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `tuuru_works` write verifiable and mutually exclusive, prevent two tabs from editing the same work, reduce article body write frequency, make multi-step editor operations atomic, and keep recoverable local data available whenever saving becomes uncertain.

**Architecture:** Keep the existing JSON database and frontend-only product. Add a Web Locks boundary, a latest-database atomic mutation primitive, one per-work save coordinator, and a shared save runtime used by both article and phone editors. Home mutations and whole-library restore use the same lock order. All new page integrations remain behind one compile-time `reliableLocalWrites` flag until article, phone, home, restore, and corrupt-reset writers have all migrated; the final activation flips that one flag for every writer together.

**Tech Stack:** Browser JavaScript ES modules, `localStorage`, Web Locks API, `storage`/page lifecycle events, Node.js `node:test` and `assert/strict`, JSDOM 27, existing DOMPurify helpers, TypeScript project checking, Vite 6. No new runtime or browser-test dependency.

## 大白话施工说明

这次不换数据库，也不联网。我们只是给现在的本地 JSON 创作库加一套“排队、核对、出错可找回”的保护层。

施工时先把新零件做好并单独测试，但不让正式页面使用。然后依次把首页、整库恢复、文章编辑器和手机编辑器接到新零件上。所有页面都接完、旧写入口也被封住以后，才在最后一个很小的提交里打开总开关。这样施工中不会出现“一半页面用新保存、一半页面仍会覆盖它”的状态。

每个编号任务默认对应一个独立 Git 提交；如果实现审查证明任务仍然太大，就先更新计划，再拆成多个写明边界的原子提交。Task 7 因此明确拆成四个提交。一个提交失败，只回退那个提交，不改写 Git 历史。每次提交之后都跑完整测试和两套构建，工作区干净后才开始下一项。

## Global Constraints

- The product remains frontend-only and local-only. Add no server, upload, community, account, cloud sync, telemetry, remote database, or new network request.
- Preserve reader behavior, single-work JSON/PNG export, complete-library backup/restore format, virtual phone drafts, mobile interactions, and all unknown compatible fields.
- Use one compile-time flag only: `FEATURE_FLAGS.reliableLocalWrites`. Do not add a URL, `localStorage`, cookie, query-string, or runtime override that could let two tabs run different write systems.
- Pure controller factories may accept injected flags/dependencies for unit tests, but production page entry points never accept or forward an override and always read `FEATURE_FLAGS` directly.
- Keep the production flag `false` through Tasks 1–26. Task 27 is the only task allowed to set it to `true`.
- While the flag is `false`, new page branches may exist but all current production behavior remains on the legacy path. While it is `true`, every legacy `tuuru_works` writer must fail closed before calling `setItem()` or `removeItem()`.
- Use the fixed admission order `tuuru:library-session` → `tuuru:work-admission:<encoded-id>` → `tuuru:work:<encoded-id>` → `tuuru:database-write`. The per-work admission lock is exclusive, `ifAvailable`, and held only while opening or registering a takeover; a live editor releases it immediately after registration and continues holding only library + work. Never acquire these locks in another order.
- `localStorage` heartbeat data is owner metadata only. It must never be treated as a mutex; Web Locks is the safety boundary.
- If Web Locks is unavailable or the page is not in a secure context, keep reading and exporting available but make every write path read-only.
- A successful save means one `setItem()`, exact readback equality, and a second full database validation. Do not report success earlier.
- Do not call `removeItem()` as part of an ordinary save or restore. The explicit corrupt-library reset remains a separate user-confirmed operation and must also hold the exclusive library and database locks.
- Preallocate IDs before a mutation enters a retryable queue. Retrying an operation must not create duplicates.
- Unknown commit results are isolated. Recheck exact raw strings; never call that batch's `apply()` function again.
- Begin every task with `git status --short --branch`. Stop if it is not clean.
- Follow strict TDD inside each task: write one focused failing behavior test, run it and observe the expected failure, implement the minimum behavior, then run the focused suite again.
- Before each commit run the focused suite, `npm run verify`, and `git diff --check`.
- After each commit rerun the focused suite and `npm run verify`, then confirm `git status --short` is empty. The Vite build may require the already-approved non-sandbox execution because the sandbox cannot read its generated parent temp path.
- Never rewrite history, force-push, squash automatically, or mix two numbered tasks in one uncommitted tree.

## Module and File Map

### New shared runtime modules

- Create `js/feature-flags.js`: immutable production flag and pure flag lookup.
- Create `js/local-locks.js`: lock names, Web Locks adapter, held-lock handle, and fail-closed errors.
- Create `js/local-write-metadata.js`: restore generation and work-owner record parsing/serialization.
- Create `js/work-edit-session.js`: long-lived editor session and short-lived home mutation session.
- Create `js/local-database-mutation.js`: exact raw atomic database commit and unknown-result recheck.
- Create `js/work-save-coordinator.js`: coalescing, generations, batching, state machine, retry, recheck, and drain.
- Create `js/work-save-runtime.js`: compose one edit session, work-version fence, atomic commit, and coordinator.
- Create `js/emergency-backup.js`: valid full-library recovery artifacts, conflict copies, and non-restorable raw drafts.
- Create `js/save-status-view.js`: accessible inline status and persistent recovery banner.
- Create `js/form-draft-registry.js`: dirty form guard contract.
- Create `js/article-body-input.js`: IME and local-candidate controller; the coordinator alone owns debounce/max-wait.
- Create `js/article-save-adapter.js`: all article work mutations, including structural atomic operations.
- Create `js/phone-save-adapter.js`: real-work scope tokens, field ownership checks, and serialized panel queues.
- Create `js/home-work-mutations.js`: locked create/update/duplicate/delete operations.

### Existing modules changed

- Modify `js/storage.js`: expose validated database serialization helpers; guard legacy writers; add restore-generation-aware locked restore support without changing backup format.
- Modify `js/data.js`: extract a pure work-record builder; retain legacy functions only for the closed-flag fallback and make their writer fail closed when the final flag is on.
- Modify `js/router.js`: serialized async transition pipeline, navigation guards, route cleanup, and accepted-URL restoration.
- Modify `js/app.js`: Promise-aware generic modal close, async route rendering, corrupt-reset migration, and route cleanup wiring.
- Modify `js/library-restore-ui.js`: exclusive restore locks, async commit, persistent generation, and current error UI.
- Modify `js/pages/new.js` and `js/pages/home.js`: locked mutations under the shared closed flag.
- Modify `js/pages/editor.js`: article runtime, body controller, form guards, status UI, and atomic article operations under the shared flag.
- Modify `js/phone-work-access.js`: preserve synchronous drafts; add registered real-work scoped access and reject whole snapshots under the shared flag.
- Modify `js/phone-modal-lifecycle.js` and `js/phone-module-draft.js`: Promise-aware close without premature removal, disposal, or success toast.
- Modify `js/pages/phone.js`: real-work scoped mutations, per-panel queues, runtime/status integration, and async drag rollback under the shared flag.
- Modify `css/styles.css`: shared save states, persistent error banner, touch targets, safe areas, narrow viewport layout, and reduced motion.
- Modify `package.json`: add only a dependency-free local lock-harness script.

### New test support and suites

- Create `tests/helpers/fake-lock-manager.mjs` and `tests/helpers/keyed-storage.mjs`.
- Create focused suites named in each task below.
- Create `browser-tests/local-lock-harness.html`, `browser-tests/local-lock-peer.html`, `browser-tests/local-lock-harness.js`, and `browser-tests/local-lock-peer.js`.
- Create `scripts/serve-lock-harness.mjs`; it serves only repository files on `127.0.0.1` and makes no external request.

## Exact Shared Contracts

These names and shapes are the dependency boundary. If implementation evidence requires changing one, update this plan and all downstream tasks before continuing.

```js
// js/feature-flags.js
export const FEATURE_FLAGS = Object.freeze({ reliableLocalWrites: false })
export function featureEnabled(name, flags = FEATURE_FLAGS) {
  return flags?.[name] === true
}
```

```js
// js/local-locks.js
export const LIBRARY_SESSION_LOCK_NAME = "tuuru:library-session"
export const DATABASE_WRITE_LOCK_NAME = "tuuru:database-write"
export function getWorkLockName(workId) {
  return `tuuru:work:${encodeURIComponent(String(workId))}`
}
export class LocalLockUnavailableError extends Error {
  constructor(message, code = "mutation-lock-unavailable", cause) {
    super(message)
    this.name = "LocalLockUnavailableError"
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}
// createWebLocksAdapter({ locks, isSecureContext }) returns
// { available, request(name, options, callback), hold(name, options) }
```

```js
// js/local-database-mutation.js
export async function commitLocalDatabaseMutation({
  operationId,
  workId,
  ownerId,
  leaseId,
  restoreGeneration,
  expectedWorkToken,
  apply, // (latestDatabase) => nextDatabase
}, {
  storage = localStorage,
  lockManager,
  assertSessionAdmission, // native lock + owner/lease + generation at DB-lock entry
  assertOwnerFence,       // owner/lease + generation immediately pre-write
} = {})
// => Promise<{ ok, operationId, raw, database, workToken }>

export async function commitPreparedLocalDatabaseCandidate({
  operationId,
  workId,
  ownerId,
  leaseId,
  restoreGeneration,
  expectedCurrentRaw,
  candidateRaw,
}, dependencies = {})
// => Promise<{ ok, operationId, raw, database, workToken }>

export async function recheckUnknownLocalDatabaseCommit({
  workId,
  ownerId,
  leaseId,
  restoreGeneration,
  expectedCurrentRaw,
  candidateRaw,
}, dependencies = {})
// => Promise<{ outcome: "saved" | "not-written" | "conflict", result? }>

export function createJsonToken(value)
// => canonical tagged string with sorted object keys
```

```js
// js/work-save-coordinator.js
export function createWorkSaveCoordinator({
  commitMutation,
  commitPreparedCandidate,
  recheckUnknown,
  scheduler = { setTimeout, clearTimeout },
  now = Date.now,
  debounceMs = 600,
  maxWaitMs = 3000,
  createOperationId = defaultCreateOperationId,
  onSnapshot,
}) {
  return {
    stage({ key, payload, apply, correctsOperationId = undefined }),
    commitNow({ key, payload, consumes = [], apply, correctsOperationId = undefined }),
    flush(),
    drain(),
    retry(),
    recheck(),
    markLeaseLost(error),
    snapshot(),
    recoveryMaterial(),
    subscribe(listener),
    dispose(),
  }
}
```

```js
// immutable operation consumed by the runtime
{
  id: "operation-id",
  key: "node:node-1:content",
  kind: "field" | "structural",
  generation: 3,
  payload: Object.freeze({ nodeId: "node-1", content: "正文" }),
  consumes: ["node:node-1:content"],
  apply(work, payload) {
    return {
      ...work,
      nodes: work.nodes.map(node => node.id === payload.nodeId
        ? { ...node, content: payload.content }
        : node),
    }
  },
}
```

```js
// js/work-save-runtime.js
export async function openWorkSaveRuntime({
  workId,
  storage = localStorage,
  lockManager,
  scheduler,
  now = Date.now,
  createId,
  takeover = false,
  onSnapshot,
}) {
  // success => { ok: true, runtime: {
    workId,
    readWork(),
    stage(operation),
    commitNow(operation),
    flush(),
    drain(),
    retry(),
    recheck(),
    snapshot(),
    recoveryMaterial(),
    subscribe(listener),
    prepareEmergencyBackup(),
    suspend(),
    resume(),
    dispose(),
  } }
  // failure => { ok: false, code, error, work, snapshot }
}
```

The runtime passes `correctsOperationId` through unchanged when forwarding `stage()` / `commitNow()` input. It never invents an implicit correction from a matching key.

Coordinator snapshots use exactly these states:

```text
clean
dirty
saving
error-retryable
error-invalid
error-unknown
conflict
lease-lost
disposed
```

Every snapshot contains `state`, `pendingCount`, `activeBatchId`, `lastSavedAt`, `error`, `canRetry`, `canRecheck`, `hasRecoverableCandidate`, `generation`, `otherActiveEditors`, and `availability`. `availability` is either null or `{ ownerId, leaseId, expiresAt, isStale, canTakeover }`.

```js
// js/phone-work-access.js, real-work contract
readStoredPhoneWorkScope(workId, scope)
// => { work, phoneData, scopeToken }

mutateStoredPhoneWork(workId, {
  scope: { writes: [], reads: [] },
  expectedScopeToken,
  apply, // receives latest phoneData and returns next phoneData
})
// => Promise<{ work, phoneData, scopeToken }>
```

## Per-Task Git and Verification Loop

Every task below expands the same mandatory loop:

1. Run `git status --short --branch`; expected output is only `## codex/phone-runtime-overhaul`.
2. Add the named failing test and run the task's RED command; confirm it fails for the stated missing behavior.
3. Implement only that task and run the task's GREEN command.
4. Run `npm run verify` and `git diff --check` before committing.
5. Stage only the named files and create the exact Conventional Commit shown.
6. Rerun the GREEN command and `npm run verify` after committing.
7. Run `git status --short`; expected output is empty. Do not begin the next task otherwise.

---

### Task 1: Add the single closed production flag and seal legacy writes

**Files:**
- Create: `js/feature-flags.js`
- Create: `tests/reliable-save-boundary.test.mjs`
- Modify: `js/storage.js`
- Modify: `tests/storage.test.mjs`

**Behavior:** The flag is immutable and false. Existing behavior is unchanged while false. `writeLocalDatabase()` and `restoreLocalDatabaseBackup()` both call one local `assertLegacyWritesAllowed()` before any database mutation, so flipping the flag later makes stale callers fail with `LocalDatabaseError.code === "legacy-write-disabled"`.

- [ ] **Step 1: Write RED tests**

Test `featureEnabled()` with an injected object, immutability of `FEATURE_FLAGS`, and a source contract that the only production default is literal `false`. Add storage tests by extracting `assertLegacyWritesAllowed(flags)` as an exported testable pure assertion; `{ reliableLocalWrites: true }` must throw before a fake storage records `set` or `remove`.

Run:

```powershell
node --test tests/reliable-save-boundary.test.mjs tests/storage.test.mjs
```

Expected RED: `js/feature-flags.js` and the legacy assertion do not exist.

- [ ] **Step 2: Implement the closed flag and guards**

Use the exact flag contract above. In `storage.js`, make both legacy mutation functions call:

```js
export function assertLegacyWritesAllowed(flags = FEATURE_FLAGS) {
  if (featureEnabled("reliableLocalWrites", flags)) {
    throw new LocalDatabaseError(
      "旧版本地写入已关闭。请重新加载页面后重试。",
      "legacy-write-disabled",
    )
  }
}
```

Do not guard read, inspect, parse, serialize, or export functions.

- [ ] **Step 3: Verify GREEN and commit**

Run the RED command, then the global verification loop. Commit:

```powershell
git add js/feature-flags.js js/storage.js tests/reliable-save-boundary.test.mjs tests/storage.test.mjs
git commit -m "feat(storage): fence reliable write rollout"
```

---

### Task 2: Build the injectable Web Locks foundation

**Files:**
- Create: `js/local-locks.js`
- Create: `tests/helpers/fake-lock-manager.mjs`
- Create: `tests/local-locks.test.mjs`

**Behavior:** Support shared/exclusive locks, `ifAvailable`, explicit `steal`, abort/release, and long-held handles. Missing Web Locks or insecure context throws `LocalLockUnavailableError`; there is no heartbeat fallback lock.

- [ ] **Step 1: Write RED tests**

The fake manager must model FIFO compatible requests, multiple shared holders, exclusive serialization, unavailable `ifAvailable` returning `null`, `steal` aborting the prior holder, and explicit release. Test exact lock names, encoded work IDs, synchronous `isLost()` transition before the replacement holder starts, and the `lost`/`released` settlement order.

Run:

```powershell
node --test tests/local-locks.test.mjs
```

Expected RED: the module and fake manager do not exist.

- [ ] **Step 2: Implement the adapter**

`createWebLocksAdapter()` returns:

```js
{
  available,
  request(name, options, callback),
  hold(name, options), // Promise<null | { name, mode, released, release() }>
}
```

`hold()` keeps the native request callback pending until `release()` and makes release idempotent. Its handle is `{ name, mode, isLost(), lost, released, release() }`: the adapter sets the internal lost flag before resolving `lost` with `{ reason: "released" | "aborted" | "stolen", error }` when the native callback ends, while `released` settles after cleanup. `assertWritable()` uses `isLost()` so it does not depend on a later Promise observer. Validate that `ifAvailable` and `steal` are not both true. Convert missing API, insecure context, abort, and stolen-holder termination into stable error codes without hiding the original cause.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused test and the global verification loop. Commit:

```powershell
git add js/local-locks.js tests/helpers/fake-lock-manager.mjs tests/local-locks.test.mjs
git commit -m "feat(storage): add local lock adapter"
```

---

### Task 3: Prove Web Locks behavior in a real local browser

**Files:**
- Create: `browser-tests/local-lock-harness.html`
- Create: `browser-tests/local-lock-peer.html`
- Create: `browser-tests/local-lock-harness.js`
- Create: `browser-tests/local-lock-peer.js`
- Create: `scripts/serve-lock-harness.mjs`
- Create: `tests/local-lock-browser-harness.test.mjs`
- Modify: `package.json`

**Behavior:** A localhost harness opens two same-origin peer page contexts and reports machine-readable PASS/FAIL rows for same-work exclusion, different-work concurrent ownership, database-write serialization, explicit stale takeover, context destruction releasing a lock, resume/reacquire behavior, and fail-closed behavior when the adapter is constructed without locks.

- [ ] **Step 1: Write the RED asset-contract test**

The Node test verifies that every harness asset exists, imports `js/local-locks.js`, uses `BroadcastChannel` only locally, contains all seven scenario IDs, and that the server rejects path traversal and binds only to `127.0.0.1`.

Run:

```powershell
node --test tests/local-lock-browser-harness.test.mjs
```

Expected RED: harness assets and script are absent.

- [ ] **Step 2: Implement the dependency-free harness**

Add script:

```json
"test:locks:browser": "node scripts/serve-lock-harness.mjs --port 4177 --timeout 180000"
```

The server binds only to `127.0.0.1`, exits automatically after 180 seconds, and also accepts local-only `POST /__shutdown`. The harness writes final JSON into `<pre id="result">` and sets `document.documentElement.dataset.result` to `pass` or `fail`, so the in-app browser can verify it without image interpretation. Do not add Playwright, Puppeteer, or any package.

- [ ] **Step 3: Verify in Node and a real browser, then commit**

Run:

```powershell
node --test tests/local-lock-browser-harness.test.mjs tests/local-locks.test.mjs
$node = (Get-Command node).Source
$server = Start-Process -FilePath $node -ArgumentList @("scripts/serve-lock-harness.mjs", "--port", "4177", "--timeout", "180000") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$server.Id
```

Open `http://127.0.0.1:4177/browser-tests/local-lock-harness.html` with the in-app browser and confirm `data-result="pass"` and seven PASS rows. Then stop only that server with `Invoke-WebRequest -Method Post http://127.0.0.1:4177/__shutdown`; if it already reached its timeout, confirm the printed PID is no longer running. Then run the global verification loop and commit:

```powershell
git add browser-tests scripts/serve-lock-harness.mjs tests/local-lock-browser-harness.test.mjs package.json
git commit -m "test(storage): add real browser lock harness"
```

---

### Task 4: Add persistent generation and owner metadata

**Files:**
- Create: `js/local-write-metadata.js`
- Create: `tests/helpers/keyed-storage.mjs`
- Create: `tests/local-write-metadata.test.mjs`
- Modify: `tests/storage.test.mjs`

**Behavior:** Store restore generation under `tuuru:restore-generation` and work owner metadata under `tuuru:work-owner:<encoded-id>`. All parsing is fail-closed and all serializers are deterministic. Existing storage fakes become keyed maps instead of pretending only one key exists.

- [ ] **Step 1: Write RED tests**

Cover missing generation, exact generation readback, malformed generation, valid/malformed owner records, owner/lease mismatch, heartbeat and `expiresAt` calculation, active-owner enumeration, and preservation of unrelated keys. The keyed fake records `{ method, key, value }` calls, supports `length`/`key(index)`, and supports per-key read/set failures.

Run:

```powershell
node --test tests/local-write-metadata.test.mjs tests/storage.test.mjs
```

Expected RED: metadata helpers and keyed storage fake are absent.

- [ ] **Step 2: Implement exact records**

Use these shapes:

```js
{ version: 1, generationId, changedAt }
{ version: 1, workId, ownerId, leaseId, heartbeatAt, expiresAt }
```

Export `LOCAL_RESTORE_GENERATION_KEY`, `getWorkOwnerKey()`, `readRestoreGeneration()`, `writeAndVerifyRestoreGeneration()`, `readWorkOwner()`, `writeAndVerifyWorkOwner()`, `clearWorkOwnerIfOwned()`, `isWorkOwnerStale(record, now, staleMs = 60000)`, and `listActiveWorkOwners(storage, now)`. `expiresAt` is always `heartbeatAt + 60000`; stale checks require both timestamp age and expiry. Reads must distinguish missing, corrupt, and storage-unavailable.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused tests and global verification loop. Commit:

```powershell
git add js/local-write-metadata.js tests/helpers/keyed-storage.mjs tests/local-write-metadata.test.mjs tests/storage.test.mjs
git commit -m "feat(storage): add local write metadata"
```

---

### Task 5: Implement exclusive work edit sessions and explicit takeover

**Files:**
- Create: `js/work-edit-session.js`
- Create: `tests/work-edit-session.test.mjs`

**Behavior:** An editor holds the library lock shared and its work lock exclusive. Opening and takeover registration are serialized by a short-lived per-work native admission lock, preventing normal opens and overlapping takeovers from stealing one another between native acquisition and owner registration. A homepage mutation uses the long-held library/work pair only for the duration of its callback. Owner registration and clearing occur while the database lock is held. Heartbeats update every 15 seconds. Takeover is allowed only after 60 seconds of stale metadata and an explicit `takeover: true` request.

- [ ] **Step 1: Write RED tests**

Use fake locks, keyed storage, fake scheduler, fake clock, and deterministic IDs. Prove:

- a second session for the same work returns `work-locked` without waiting;
- a failed work-lock request releases its already-held shared library lock and leaves no owner record;
- different works hold shared library locks concurrently;
- concurrent normal opens and explicit takeovers for one work are serialized by a short-lived native admission lock without waiting or using owner metadata as a mutex;
- owner/lease registration happens after work ownership and inside database lock;
- every registration verifies all currently held native handles (library, admission, and work) at database-lock admission and again immediately before writing;
- every heartbeat reacquires the database lock, verifies that its owner/lease pair is still current, then writes/readbacks `heartbeatAt` and `expiresAt`;
- normal dispose clears only its own token and releases work before library;
- simulated crash releases native locks while stale metadata remains;
- a free native work lock replaces even a fresh orphan owner record without `steal`;
- while the native lock is still held, takeover before 60 seconds fails and explicit takeover after 60 seconds steals and registers a new lease;
- a commit already inside database lock finishes before the new takeover token is written;
- old-lease `assertWritable()` fails immediately after takeover;
- after `steal` ends the old native work lock but before the new owner record is written, an old commit that was only waiting for the database lock fails admission with zero writes;
- a late heartbeat from the stolen session cannot overwrite the new owner record and instead marks the old session lease-lost;
- owner metadata read/write/readback failure, restore-generation read failure, database-lock failure, or any takeover step failure cancels heartbeat, attempts metadata cleanup only under the database lock and only for the same owner/lease, then releases work and library; if the database lock itself is unavailable, it leaves only the expiring metadata record and never clears it unsafely outside the lock;
- `runWithWorkEditSession()` performs that cleanup in `finally` when its callback throws or rejects;
- missing Web Locks produces a read-only session result, not a fallback mutex.

Run:

```powershell
node --test tests/work-edit-session.test.mjs
```

Expected RED: session module is absent.

- [ ] **Step 2: Implement the session contract**

Export:

```js
openWorkEditSession(options)
runWithWorkEditSession(options, callback)
inspectWorkEditAvailability(options)
```

The returned session exposes `ownerId`, `leaseId`, `restoreGeneration`, `assertWritable()`, `assertSessionAdmission()`, `assertOwnerFence()`, `refreshHeartbeat()`, `markLeaseLost()`, and idempotent `dispose()`. Acquire library → short-lived per-work admission → work → database in that order. The admission request is `ifAvailable` and is released immediately after successful owner registration; it is never a long-lived editor lock. Never wait indefinitely for `ifAvailable` editor/home requests. Opening and takeover use one cleanup stack: every acquired handle is released in reverse order, heartbeat is cancelled first, and owner metadata cleanup is attempted under the database lock only after an exact self owner/lease match; failure to reacquire that lock leaves the expiring record rather than mutating it unsafely. `runWithWorkEditSession()` always disposes in `finally` and preserves arbitrary JavaScript rejection values, including `null` and `undefined`. Owner registration, heartbeat refresh, and owner clearing all occur under the database lock with an exact owner/lease check. Registration verifies its library, admission, and work handles at database-lock admission and immediately before the owner write. `assertWritable()` and `assertSessionAdmission()` observe the held work handle's lost flag; admission additionally verifies current owner/lease and generation when the database-lock callback begins. Once admitted inside the database lock, a mutation may finish even if `steal` occurs, because takeover cannot register the new lease until that database lock releases. Immediately before writing, `assertOwnerFence()` rechecks owner/lease and generation but intentionally does not inspect the native handle, so it does not retroactively cancel an already-admitted commit. A commit that was merely queued when native ownership ended fails admission with zero writes. The session observes unexpected `lost` settlement and blocks every later batch. A `storage` event may update displayed owner information, but only native lock loss or owner/lease/generation mismatch revokes future writes.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused test and global verification loop. Commit:

```powershell
git add js/work-edit-session.js tests/work-edit-session.test.mjs
git commit -m "feat(editor): add exclusive work sessions"
```

---

### Task 6: Add the exact-readback atomic database mutation

**Files:**
- Create: `js/local-database-mutation.js`
- Create: `tests/local-database-mutation.test.mjs`
- Modify: `js/storage.js`
- Modify: `tests/storage.test.mjs`

**Behavior:** Every normal database mutation starts from the latest exact raw value inside `tuuru:database-write`, verifies generation and owner before reading and immediately before writing, validates the full candidate, rechecks the exact source raw, performs one `setItem()`, then verifies exact readback and full validity.

- [ ] **Step 1: Write RED tests**

Cover:

- latest database is read only after the database lock is acquired;
- different-work mutations serialize and preserve both changes;
- source raw changing before `setItem()` returns `mutation-conflict` with zero writes;
- owner, lease, native-lock, or generation mismatch at database-lock admission returns `mutation-lease-lost` with zero writes; owner/lease/generation mismatch immediately before write also returns it, while a batch already admitted before native loss is allowed to finish;
- invalid `apply()` output returns `mutation-invalid` with zero writes;
- quota/permission `setItem()` failure reports `mutation-write-failed`, `commitState: "unchanged"`, and retains exact old raw;
- exact readback and revalidation are both required for success;
- readback throw reports `mutation-readback-failed`; mismatch or invalid readback reports `mutation-verification-failed`; both use `commitState: "unknown"`, retain `expectedCurrentRaw` and `candidateRaw`, and never retry automatically;
- `recheckUnknownLocalDatabaseCommit()` runs under the database lock after `assertSessionAdmission()`, returns only `saved`, `not-written`, or `conflict` by exact raw comparison, includes verified raw/database/work token for saved/conflict, and never invokes `apply()`;
- `commitPreparedLocalDatabaseCandidate()` can retry only the exact validated `candidateRaw` after a `not-written` recheck and never invokes `apply()`;
- a preallocated ID stays singular after a confirmed-not-written retry.

Run:

```powershell
node --test tests/local-database-mutation.test.mjs tests/storage.test.mjs
```

Expected RED: atomic mutation exports are absent.

- [ ] **Step 2: Expose pure validated serialization**

From `storage.js`, export `validateLocalDatabase(data)`, `serializeValidatedLocalDatabase(data)`, and `serializeLocalDatabaseBackupFromDatabase(database, exportedAt)`. Keep `inspectLocalDatabaseRaw()` as the sole raw parser. These pure helpers must preserve unknown fields and must not touch storage.

- [ ] **Step 3: Implement the atomic commit and recheck**

Return success only as:

```js
{
  ok: true,
  operationId,
  raw: candidateRaw,
  database: verifiedStatus.data,
  workToken: createJsonToken(targetWork),
}
```

`createJsonToken()` recursively tags JSON primitive types, preserves array order, and sorts object keys before serialization; it therefore ignores harmless object-key insertion order without confusing missing fields with present values. Phone scope tokens wrap each selected field as `{ key, present, value }` before calling it, so absence is distinct. `recheckUnknownLocalDatabaseCommit()` uses database-lock admission and exact comparison only. `commitPreparedLocalDatabaseCandidate()` uses the same admission check and the same owner/lease/generation pre-write fence as a normal commit, validates, and writes the supplied raw string directly. Neither invokes `apply()`. Attach `{ phase, commitState, expectedCurrentRaw, candidateRaw }` under `error.details` on each `LocalDatabaseError` where available. Do not roll back after an unknown result.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused tests and global verification loop. Commit:

```powershell
git add js/local-database-mutation.js js/storage.js tests/local-database-mutation.test.mjs tests/storage.test.mjs
git commit -m "feat(storage): verify atomic local mutations"
```

---

### Task 7: Implement the save coordinator state machine

> Detailed, authoritative Task 7 contract: [`2026-07-12-work-save-coordinator.md`](./2026-07-12-work-save-coordinator.md). It splits implementation into four atomic commits and closes the flush-target, structural-barrier, disposal-quiescence, typed-waiter, explicit-correction, and context-sensitive recovery gaps discovered during implementation review.

**Files:**
- Create: `js/work-save-coordinator.js`
- Create: `tests/work-save-coordinator.test.mjs`

**Behavior:** Coalesce field edits by key, preserve immutable payloads and generations, batch pending field edits before structural operations, and expose reliable `flush()`, `drain()`, retry, unknown recheck, lease loss, subscription, and disposal behavior.

- [ ] **Step 1: Use the detailed per-commit RED suites and keep this final acceptance matrix**

The authoritative detailed plan decides which RED tests are added before each of the four implementations. Do not accumulate this entire matrix in one uncommitted tree. By the end of Task 7, prove:

- a field edit waits for 600 ms of quiet;
- continuous edits commit no later than 3000 ms after the first dirty generation;
- repeated staging of one key keeps only the newest immutable payload;
- different staged fields apply in staging sequence;
- a structural operation captures every field pending at its call boundary, records `consumes` only as ownership metadata, then applies itself last in that same frozen batch;
- `commitNow()` resolves only when its own operation generation is verified;
- simultaneous `flush()` calls share one active commit;
- a `flush()` called while an older batch is active also waits for edits already pending at that call boundary, but not edits staged later;
- simultaneous `drain()` calls share one drain Promise and still include edits staged while the first batch is active;
- `drain()` loops when edits arrive during an active commit and resolves only after generations stabilize;
- a confirmed unchanged `mutation-write-failed` batch remains queued and `retry()` reuses its operation IDs;
- `error-invalid` cannot retry the invalid candidate; only a stage/structural input that explicitly names the blocked operation ID and matches its key/kind may correct it;
- `error-unknown` freezes all later writes until `recheck()` returns saved/not-written/conflict;
- edits staged while the uncertain batch was still in flight remain as later pending generations; once unknown is observed, new staging is rejected but those earlier later generations are never discarded;
- unknown not-written retries through `commitPreparedLocalDatabaseCandidate()` with the frozen raw strings and without calling the old operation `apply()` again;
- `markLeaseLost()` and `dispose()` reject new staging and settle pending callers with stable errors;
- subscription emits snapshots without repeating identical `clean` announcements.

- [ ] **Step 2: Keep these shared invariants while implementing the four detailed tasks**

Implement only the slice assigned to the current detailed task, verify it, commit it, and return to a clean tree before starting the next slice.

Clone each payload at `stage()`/`commitNow()` time and freeze the operation descriptor. A batch stores its exact included generations; success clears only a key whose current generation still equals the included generation. Keep structural operations FIFO. Copy trusted `expectedCurrentRaw` and `candidateRaw` from recognized unknown errors into a separate callback-free frozen envelope.

The injected `recheckUnknown(frozenUnknownBatch)` returns `{ outcome: "saved", result }`, `{ outcome: "not-written" }`, or `{ outcome: "conflict", result }`. `result`, when present, contains verified `raw`, `database`, and `workToken` for the runtime baseline. After `not-written`, `retry()` must call injected `commitPreparedCandidate(frozenUnknownBatch)`; it never calls `commitMutation()` or an old uncertain operation callback. When saved/prepared retry succeeds, the coordinator adopts that baseline and continues draining later pending generations. `recoveryMaterial()` returns `null`, frozen `{ kind: "ordinary", pendingOperations, correctableOperationIds }`, or frozen `{ kind: "unknown", uncertainBatch, laterPendingOperations }`. In `error-invalid`, `correctableOperationIds` contains only the blocked invalid batch IDs; later ready/pending IDs are excluded, and every other state uses an empty frozen array. Unknown provenance remains `kind: "unknown"` after not-written and in later terminal states. The uncertain batch's callbacks are never exposed for replay, but operations staged while it was in flight remain recoverable.

`error-invalid` blocks `retry()` and ordinary new input. An explicit correction uses `correctsOperationId` to name one blocked operation and must match its key and method-implied kind. The replacement receives a new operation ID but keeps the old generation, the rebuilt batch receives a new ID, other operations remain identical, and later same-key input stays behind it. The coordinator never silently drops an invalid operation merely because time passed.

The error mapping is fixed:

| Error code | Coordinator state | Allowed recovery action |
|---|---|---|
| `mutation-write-failed` with `unchanged` | `error-retryable` | `retry()` |
| `mutation-read-failed` with `unchanged` | `error-retryable` | `retry()` |
| `mutation-invalid` with `unchanged` in `apply` / `validate-candidate` | `error-invalid` | matching `correctsOperationId` correction only |
| source/input `mutation-invalid` outside recheck | `conflict` (fail closed) | backup/reload |
| `mutation-invalid` thrown while rechecking an unknown write | keep `error-unknown` | `recheck()` / backup |
| recognized `mutation-readback-failed` / `mutation-verification-failed` with complete trusted raw material | `error-unknown` | `recheck()` |
| `mutation-conflict` | `conflict` | backup/reload |
| `mutation-lease-lost`, `work-locked` | `lease-lost` | backup/leave/takeover when stale |
| `mutation-lock-unavailable` | `lease-lost` with distinct error code | read-only/export/leave |

- [ ] **Step 3: Follow the detailed four-commit Task 7 plan**

Run the focused test and global verification loop after each atomic task. The commit map is:

| Detailed task | Commit message |
|---|---|
| Successful batching | `feat(editor): add deterministic save batching` |
| Ordinary retry ledger | `feat(editor): add ordinary save retry ledger` |
| Callback-free unknown recovery | `feat(editor): add callback-free unknown recovery` |
| Terminal recovery lifecycle | `feat(editor): finalize terminal save lifecycle` |

---

### Task 8: Compose the per-work save runtime

**Files:**
- Create: `js/work-save-runtime.js`
- Create: `tests/work-save-runtime.test.mjs`

**Behavior:** Open one work session, capture the stored work token and restore generation, feed coordinator batches into the atomic commit, detect external changes to the current work without treating other-work changes as conflicts, and own suspension/resume/disposal. The open result is discriminated: success is `{ ok: true, runtime }`; failure is `{ ok: false, code, error, work, snapshot }`, where code is `work-missing`, `work-locked`, `mutation-lock-unavailable`, or `runtime-init-failed`. When safely readable, `work` remains available for read-only rendering/export. Locked failures include validated owner expiry/staleness in `snapshot.availability`; only stale locked records set `canTakeover: true`.

- [ ] **Step 1: Write RED integration tests**

Cover:

- open returns the exact discriminated read-only result when the target work is missing, locked, or Web Locks is unavailable, including owner `expiresAt`/`canTakeover` only for a stale held lock;
- failure while reading/validating the initial database or constructing the coordinator after session acquisition disposes the partial runtime, cancels listeners/timers, clears only its own metadata, and releases work then library;
- two runtimes for different works preserve both edits through the shared database lock;
- `readWork()` returns a clone of the latest local candidate (verified baseline plus ordinary pending operations), so a newly opened panel never receives the page-open snapshot;
- a storage change to another work is merged from latest raw;
- active owner records for other works populate `otherActiveEditors`; owner-key storage events update that warning without changing save state;
- an owner-key event for the current work whose record is missing, corrupt, or has a different owner/lease, or a restore-generation event whose value is missing, corrupt, or different, synchronously marks the runtime lease-lost, cancels save timers, rejects later batches, and retains recovery material;
- external replacement/deletion of the current work enters `conflict` and retains the local candidate;
- the runtime advances its expected work token only after verified success;
- a staged edit inside the first 600 ms is already present when `prepareEmergencyBackup()` builds a recovery-only candidate;
- unknown recheck `saved` adopts the returned verified raw/work token, `not-written` uses prepared-candidate commit, and `conflict` freezes without replay;
- edits staged while the unknown batch was in flight continue from the candidate baseline after saved/prepared resolution; conflict and lease loss retain them for recovery without replaying the uncertain batch;
- one successful batch updates the target work's `updatedAt` exactly once, while failed/unknown pre-write attempts do not alter stored `updatedAt`;
- `suspend()` drains if possible, stops timers, releases ownership, and keeps recovery material;
- `resume()` reacquires library/work locks and rejects a changed generation or work token;
- a `pageshow`-style resume after whole-library restore becomes `lease-lost` and cannot write back;
- if native ownership is stolen after a batch was admitted inside the database lock, that batch may verify successfully but the runtime remains `lease-lost`; its success cannot re-enable editing or admit a later batch;
- `dispose()` drains when explicitly requested, releases exactly once, unregisters listeners, and makes late timers harmless.

Run:

```powershell
node --test tests/work-save-runtime.test.mjs
```

Expected RED: runtime module is absent.

- [ ] **Step 2: Implement the composition**

Wrap post-session runtime initialization in `try`/`catch`; on any error await session disposal before returning/throwing the discriminated open failure. For each coordinator batch, apply field operations in sequence and structural operations last to the latest stored work. Compare `createJsonToken(latestWork)` with the runtime's expected work token before applying. After all operations, the runtime alone sets the target work's `updatedAt = now()` exactly once for that batch. Pass the session's owner ID, lease ID, native-lock admission assertion, and captured restore generation into `commitLocalDatabaseMutation()`. Update runtime baseline from the verified result only. `readWork()` and recovery candidate building share one pure ordinary-pending candidate builder. In an unknown state, that builder starts from the already-serialized `candidateRaw` and applies only `laterPendingOperations`; it never calls an uncertain-batch callback. Tests prove a verified batch advances `updatedAt` once and every failed or unknown pre-write path leaves stored `updatedAt` unchanged.

Listen for `storage` events on the database, owner, and restore-generation keys. Other-work owner events update `listActiveWorkOwners()` and warning state only. A current-work owner/lease mismatch or restore-generation mismatch calls `markLeaseLost()` inside the event handler before any asynchronous reinspection, freezes timers/queues, and preserves recovery material. Database events trigger work-token reinspection, not direct writes. Page lifecycle hooks are exposed as methods; page modules register the actual listeners in later tasks.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused test and global verification loop. Commit:

```powershell
git add js/work-save-runtime.js tests/work-save-runtime.test.mjs
git commit -m "feat(editor): compose reliable work runtime"
```

---

### Task 9: Generate emergency full-library recovery artifacts

**Files:**
- Create: `js/emergency-backup.js`
- Create: `tests/emergency-backup.test.mjs`
- Modify: `js/work-save-runtime.js`
- Modify: `tests/work-save-runtime.test.mjs`

**Behavior:** Produce the existing versioned full-library backup format from the latest valid stored database plus this runtime's valid pending candidate. Never include another tab's memory or an unconfirmed form draft. Never replay an unknown operation.

- [ ] **Step 1: Write RED recovery tests**

Test these exact branches:

- clean/dirty and ordinary retryable recovery start from the newest valid stored database and build one recovery-only candidate from the coordinator's current immutable pending operations; unknown provenance, including not-written in `error-retryable`, follows the unknown branches below;
- storage unreadable falls back to the runtime's last verified valid raw;
- invalid candidate returns a valid last-known library artifact plus a separate `restorable: false` raw-draft artifact only when safe serialization succeeds;
- unknown with current raw equal to `candidateRaw` backs up current storage;
- unknown with current raw equal to `expectedCurrentRaw` backs up the stored `candidateRaw` without applying operations;
- unknown with a third valid raw preserves that database and appends the candidate work as a pre-ID'd `冲突恢复副本` with recovery metadata;
- unknown when current storage cannot be read uses the valid `expectedCurrentRaw` baseline, appends the candidate work as a recovery copy, and records that current browser storage could not be confirmed;
- every unknown branch applies only later generations that were staged while the uncertain write was in flight, using `candidateRaw` as their base; none replays the uncertain batch itself;
- conflict/lease-lost also preserves stored work and appends the local version instead of overwriting it;
- active owner records for other works produce persistent warning metadata that their in-memory edits are not in this file and must be handled in those tabs;
- IDs and recovery timestamps are injected and stable across repeated download attempts;
- no unknown branch invokes the uncertain batch's `apply()` callback; ordinary and later-pending recovery may apply their own frozen operations only to a non-writing clone;
- filename follows `tuuru-emergency-backup-<ISO-with-dashes>.json` and copy identifies private full-library data.

Run:

```powershell
node --test tests/emergency-backup.test.mjs tests/work-save-runtime.test.mjs
```

Expected RED: emergency backup module and runtime method are absent.

- [ ] **Step 2: Implement artifact preparation**

Export:

```js
prepareEmergencyLocalDatabaseBackup({
  storage,
  workId,
  saveSnapshot,
  lastValidRaw,
  localCandidateRaw,
  now,
  recoveryWorkId,
})
// => { artifacts, warning, otherActiveEditors: [{ workId, ownerId, expiresAt }] }
```

Validate every restorable full-library candidate with `inspectLocalDatabaseRaw()` and serialize it with `serializeLocalDatabaseBackupFromDatabase()`. For `kind: "ordinary"` recovery, including ordinary retryable state, the runtime may apply immutable pending payloads to a recovery-only clone; it must not schedule or write that clone. For `kind: "unknown"`, including not-written provenance, it uses the stored raw strings for the uncertain generation, never invokes that batch's callbacks, and may apply only separately retained later pending operations to a clone of `candidateRaw`. Recovery metadata contains source work ID, source state, and recovered timestamp; it contains no device or network identifier.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests and the global verification loop. Commit:

```powershell
git add js/emergency-backup.js js/work-save-runtime.js tests/emergency-backup.test.mjs tests/work-save-runtime.test.mjs
git commit -m "feat(storage): preserve emergency local backups"
```

---

### Task 10: Add the accessible persistent save-status UI

**Files:**
- Create: `js/save-status-view.js`
- Create: `tests/article-save-status.test.mjs`
- Modify: `css/styles.css`

**Behavior:** A quiet inline state lives in the editor shell. Durability errors use a persistent banner and explicit actions rather than a disappearing toast. The same component serves article and phone editors.

- [ ] **Step 1: Write RED JSDOM tests**

Render every coordinator state and assert exact visible actions:

| State | Primary copy | Actions |
|---|---|---|
| `clean` | 已保存 | none |
| `dirty` | 未保存 | none |
| `saving` | 正在保存 | none |
| `error-retryable` | 保存失败，原数据未改变 | 重试、下载紧急备份、放弃修改并离开 |
| `error-invalid` | 当前内容无法安全保存 | 纠正内容、下载紧急备份 |
| `error-unknown` | 无法确认刚才是否保存 | 重新检查、下载紧急备份 |
| `conflict` | 本地创作库已发生冲突 | 下载紧急备份、重新加载 |
| `lease-lost` + `mutation-lease-lost` | 此页面已失去编辑权 | 下载紧急备份、返回作品列表；过期后确认接管 |
| `lease-lost` + `work-locked` | 此作品正在另一个标签页编辑 | 重新检查、返回作品列表；过期后确认接管 |
| `lease-lost` + `mutation-lock-unavailable` | 当前浏览器不能保证可靠本地保存 | 保持只读、导出已有作品、返回作品列表 |

Also prove role selection (`status` for quiet announcements, `alert` for persistent failure), keyboard activation, disabled/single-flight actions, focus retention after action failure, a second confirmation before discard, hidden takeover while a lease is valid, and persistent copy when `otherActiveEditors` says another tab's in-memory edits are not included. The invalid correction action passes the exact frozen ordinary recovery record to `onCorrectInvalid` and performs no retry or mutation itself. When later pending operations also exist, the chooser offers only IDs in `correctableOperationIds`, never every `pendingOperations` entry. Run at least two full `clean → dirty → saving → clean` cycles: visible text may change on every state, but the separate quiet live region announces only the first unsaved entry, final verified completion, and recovery from an error; it never repeats `saving` or chatters on every autosave cycle. JSDOM covers DOM, ARIA, focus, and action state only. A source-contract assertion covers the 44px minimum, 320px wrapping rule, safe-area variables, and reduced-motion media query; real computed layout remains in the final browser matrix.

Run:

```powershell
node --test tests/article-save-status.test.mjs
```

Expected RED: component and styles do not exist.

- [ ] **Step 2: Implement the shared view**

Export:

```js
mountSaveStatus({
  container,
  runtime = null,
  initialSnapshot = null,
  onReload,
  onLeave,
  onDiscardAndLeave,
  onCorrectInvalid,
  confirmDiscard,
  onRecheckLock,
  onTakeover,
  onExportWork,
  download,
})
// => { render(snapshot), focusError(), dispose() }
```

The component accepts either a live runtime or an `initialSnapshot` from a failed open result and keeps visible status text separate from its quiet announcement node. Per mounted editor, the quiet node announces the first transition into dirty and the first later verified clean once, then suppresses routine dirty/saving/clean autosave cycles; each distinct persistent error uses the alert, and the first verified recovery from that error may announce once. In `error-invalid`, the correction action calls `onCorrectInvalid(runtime.recoveryMaterial())`; it never guesses a key or retries by itself. The page controller must restrict selection to `correctableOperationIds`, resolve the matching blocked operation from `pendingOperations`, and pass only that exact ID to the owning adapter. `download` calls `runtime.prepareEmergencyBackup()` and then the existing `downloadBlob()` for each artifact. A download attempt never changes the save state to clean and copy must say the browser only confirmed that the download was started. The view selects lock-unavailable, work-locked, and lease-lost copy from `snapshot.error.code`; it does not collapse them into one generic message. `onTakeover` is rendered only when `snapshot.availability.canTakeover === true` and still requires explicit confirmation in the page controller.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused test, existing mobile viewport/accessibility tests, and global verification loop:

```powershell
node --test tests/article-save-status.test.mjs tests/article-editor-mobile-shell.test.mjs tests/phone-editor-viewport.test.mjs tests/phone-icon-accessibility.test.mjs
```

Commit:

```powershell
git add js/save-status-view.js css/styles.css tests/article-save-status.test.mjs
git commit -m "feat(editor): show persistent save status"
```

---

### Task 11: Serialize router transitions and route cleanup

**Files:**
- Modify: `js/router.js`
- Modify: `tests/router.test.mjs`
- Create: `tests/router-lifecycle.test.mjs`

**Behavior:** Navigation guards run before DOM, accepted route, or params change. Only the latest target survives while a guard is pending. Rejected back/hash navigation restores the accepted URL with `history.replaceState()`. Cleanup runs exactly once per accepted departure.

- [ ] **Step 1: Write RED lifecycle tests**

Using injected location/history/window/container objects, prove:

- `navigate()` returns `Promise<boolean>`;
- guard rejection keeps current DOM/route/params and restores the accepted hash without another transition;
- three targets requested during one pending guard render only the latest; superseded `navigate()` Promises resolve `false` and the accepted latest Promise resolves `true`;
- old route cleanup runs once after guard acceptance and before new rendering;
- a rejected target does not clean up;
- async route rendering is awaited and errors do not leave a second active lifecycle;
- disposer removes hash listeners and runs the current cleanup once;
- existing parse and pattern behavior remains unchanged.

Run:

```powershell
node --test tests/router.test.mjs tests/router-lifecycle.test.mjs
```

Expected RED: current router is synchronous and has no guard/cleanup contract.

- [ ] **Step 2: Implement one transition pump**

Export `registerNavigationGuard(guard)`, `registerRouteCleanup(cleanup)`, and async `navigate(path, params)`. `initRouter(container, dependencies = {})` owns one accepted hash and one pending latest target. It serializes guard evaluation and renders only after acceptance. Update `currentRoute` and `currentParams` only after guards pass. Use `history.replaceState(null, "", acceptedHash)` for rejection.

Do not clear the container when a guard fails. Dispose callbacks are idempotent even if a page registers the same cleanup through multiple UI exits.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests and the global verification loop. Commit:

```powershell
git add js/router.js tests/router.test.mjs tests/router-lifecycle.test.mjs
git commit -m "refactor(router): serialize guarded transitions"
```

---

### Task 12: Add form-draft and IME-safe body controllers

**Files:**
- Create: `js/form-draft-registry.js`
- Create: `js/article-body-input.js`
- Create: `tests/form-draft-registry.test.mjs`
- Create: `tests/article-body-input.test.mjs`

**Behavior:** Unconfirmed forms participate in navigation protection without entering saved work data. Article body input updates the local candidate immediately but schedules no write while IME composition is active.

- [ ] **Step 1: Write RED form-draft tests**

Exact registry API:

```js
createFormDraftRegistry({ choose })
// register({ id, isDirty, validate, save, discard, focus }) => unregister
// confirmNavigation() => Promise<boolean>
// hasDirtyDrafts(), discardAll(), dispose()
```

Prove save validates then awaits commit/drain, discard alone clears, continue-editing returns false and focuses the first dirty form, save failure returns false without clearing, unregister removes only its form, and concurrent navigation prompts share one result.

- [ ] **Step 2: Write RED article input tests**

Exact controller API:

```js
createArticleBodyInput({
  nodeId,
  readValue,
  stageValue,
})
// input(), compositionStart(), compositionEnd(), isComposing(),
// hasUnresolvedInput(), freeze(), dispose()
```

Prove no staging during composition, `compositionEnd()` stages only final text, every normal input immediately calls `stageValue()` with the newest local candidate, `isComposing()`/`hasUnresolvedInput()` synchronously expose guard state, `freeze()` waits for composition end, and disposal rejects late DOM events without discarding the last local candidate. The coordinator alone owns the 600/3000 timers; this controller must not create a timer.

Run:

```powershell
node --test tests/form-draft-registry.test.mjs tests/article-body-input.test.mjs
```

Expected RED: both modules are absent.

- [ ] **Step 3: Implement both pure controllers**

The draft registry owns no DOM other than calling injected `choose`/`focus`. The body controller owns no storage, scheduler, debounce, or max-wait timer. A composing controller counts as unresolved work for navigation and `beforeunload` decisions.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests and the global verification loop. Commit:

```powershell
git add js/form-draft-registry.js js/article-body-input.js tests/form-draft-registry.test.mjs tests/article-body-input.test.mjs
git commit -m "feat(editor): guard drafts and IME input"
```

---

### Task 13: Isolate whole-library restore and corrupt reset

**Files:**
- Modify: `js/storage.js`
- Modify: `js/library-restore-ui.js`
- Modify: `js/app.js`
- Modify: `tests/storage.test.mjs`
- Modify: `tests/library-restore-ui.test.mjs`
- Modify: `tests/storage-recovery-ui.test.mjs`
- Create: `tests/local-database-restore-locks.test.mjs`

**Behavior:** Under the still-closed reliable flag, prepare the new restore/reset branch. Restore obtains `tuuru:library-session` exclusive with `ifAvailable`, then `tuuru:database-write`. It advances and verifies persistent restore generation before replacing the database. If database replacement later fails, generation intentionally stays advanced.

- [ ] **Step 1: Write RED restore-lock tests**

Prove:

- any shared editor library session makes restore fail immediately with `restore-editors-active` and zero writes;
- while restore holds the exclusive library lock, a new editor session cannot start;
- database replacement occurs only inside the database lock;
- the prepared plan's exact-current-raw check runs first inside the database lock, then generation is written/read back before the database key;
- generation write failure leaves the database untouched;
- generation readback failure/mismatch leaves the database untouched, reports generation state unknown, and never rolls generation back;
- database write failure leaves the new generation in place and reports old database unchanged;
- database readback uncertainty reports unknown and never rolls back either key;
- exact prepared-plan conflict behavior and backup format remain unchanged;
- successful restore dispatches one same-page `tuuru:local-database-replaced` CustomEvent with `{ generationId }` and requests reload; other tabs continue to observe native `storage` events;
- stale runtime resume after generation change cannot write;
- explicit corrupt reset also holds exclusive library then database and cannot run while an editor is active.
- corrupt reset rereads inside the database lock and refuses to remove when the key has changed or become valid since the confirmation screen;
- missing/insecure Web Locks makes restore and corrupt reset fail closed before generation or database mutation.

Run:

```powershell
node --test tests/local-database-restore-locks.test.mjs tests/storage.test.mjs tests/library-restore-ui.test.mjs tests/storage-recovery-ui.test.mjs
```

Expected RED: restore and reset are synchronous and lock-free.

- [ ] **Step 2: Implement locked storage operations**

Add:

```js
restoreLocalDatabaseBackupLocked(plan, {
  storage,
  lockManager,
  createGenerationId,
  now,
})

discardCorruptLocalDatabaseLocked({
  storage,
  lockManager,
  expectedCurrentRaw,
  createGenerationId,
  now,
})
```

Both return Promises. Restore retains the prepared plan's exact-source check and performs it before changing generation, then uses one database `setItem()`. Reset is the sole allowed `removeItem(LOCAL_DATABASE_KEY)` path, remains explicitly user-confirmed, advances generation first, and verifies the database key is absent afterward. Neither operation rolls generation back. The legacy `discardCorruptLocalDatabase()` also calls `assertLegacyWritesAllowed()` before `removeItem()`, so it cannot bypass the reliable true branch.

Export `LOCAL_DATABASE_REPLACED_EVENT = "tuuru:local-database-replaced"`. `library-restore-ui.js` dispatches `new CustomEvent(LOCAL_DATABASE_REPLACED_EVENT, { detail: { generationId } })` on its injected `windowObject` only after verified success and immediately before reload. Do not add `BroadcastChannel`; cross-tab runtimes already receive the generation/database `storage` events.

- [ ] **Step 3: Wire only the closed new branch**

`startLocalLibraryRestore()` accepts `flags`, `lockManager`, `createGenerationId`, `restoreLegacy`, and `restoreLocked`, with production defaults pointing to the matching storage functions. When the flag is false it preserves the current legacy call exactly. When true it awaits the locked operation, keeps the dialog connected/single-flight, disables close during commit, and maps active editors/unknown results to persistent text. `app.js` exposes the same injectable controller boundary for corrupt reset. Every UI test injects both its intended flag object and fake mutation dependency; no test invokes a globally guarded legacy writer or relies on the production default, so Task 27 cannot silently change which branch a fixture exercises.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused command, all restore tests, and the global verification loop. Commit:

```powershell
git add js/storage.js js/library-restore-ui.js js/app.js tests/storage.test.mjs tests/library-restore-ui.test.mjs tests/storage-recovery-ui.test.mjs tests/local-database-restore-locks.test.mjs
git commit -m "feat(storage): isolate restore from editors"
```

---

### Task 14: Migrate home and new-work mutations behind the closed flag

**Files:**
- Create: `js/home-work-mutations.js`
- Create: `tests/home-work-mutations.test.mjs`
- Create: `tests/home-write-ui.test.mjs`
- Modify: `js/data.js`
- Modify: `js/pages/home.js`
- Modify: `js/pages/new.js`

**Behavior:** Create, metadata update, duplicate, and delete use short-lived work sessions and the atomic database primitive. Active editors make update/delete/duplicate fail closed. IDs are allocated before lock/commit. The current synchronous UI remains active while the shared production flag is false.

- [ ] **Step 1: Write RED pure mutation tests**

Extract and test:

```js
createWorkRecord(data, {
  workId,
  firstChapterId,
  firstNodeId,
  colorSeedId,
  now,
})
```

Its output must match current article/phone defaults, preserve generated IDs across retry, and perform no storage access. Then test `createHomeWork()`, `updateHomeWorkInfo()`, `duplicateHomeWork()`, and `deleteHomeWork()` for one verified database write, missing work, active editor lock, missing/insecure Web Locks with zero writes, different-work preservation, and preallocated duplicate ID.

Run:

```powershell
node --test tests/home-work-mutations.test.mjs
```

Expected RED: builder and locked home functions are absent.

- [ ] **Step 2: Implement locked home operations**

Each function calls `runWithWorkEditSession()` and then `commitLocalDatabaseMutation()`. Create locks its preallocated new work ID. Update, delete, and duplicate lock the existing source/target work ID, so an active editor blocks all three; duplicate's separately preallocated destination ID is collision-checked inside the database lock. Update and delete compare the expected work token captured for the confirmation dialog. Duplicate reads the source inside the lock and inserts a deep clone with new work ID/title/timestamps. Never hold a whole-database snapshot across the lock request.

- [ ] **Step 3: Write RED UI branch tests and wire it**

Test exported page controllers with injected `flags` and mutation functions. With false, exact legacy synchronous behavior remains. With true, buttons stay single-flight, success toasts/navigation happen only after verified Promise resolution, failures retain modal/form state and show persistent errors, and a locked work explains that it is open in another tab.

Run:

```powershell
node --test tests/home-work-mutations.test.mjs tests/home-write-ui.test.mjs
```

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests and the global verification loop. Commit:

```powershell
git add js/home-work-mutations.js js/data.js js/pages/home.js js/pages/new.js tests/home-work-mutations.test.mjs tests/home-write-ui.test.mjs
git commit -m "feat(home): guard local work mutations"
```

---

### Task 15: Build the complete article save adapter

**Files:**
- Create: `js/article-save-adapter.js`
- Create: `tests/article-save-adapter.test.mjs`
- Create: `tests/article-atomic-save.test.mjs`

**Behavior:** Express every article-editor write as one runtime operation. Field updates can coalesce; structural updates are one commit and consume relevant pending fields.

- [ ] **Step 1: Write RED adapter tests**

The adapter exports:

```js
createArticleSaveAdapter({ runtime, createId, now })
// stageNodeContent(nodeId, content)
// updateWorkFields(fields)
// addNode({ afterId, nodeId })
// updateNode(nodeId, fields)
// deleteNode(nodeId)
// replaceChoices(nodeId, choices)
// addChapter({ chapterId, name })
// deleteChapter(chapterId)
// addScene({ sceneId, name })
// deleteScene(sceneId)
// addPlaceholders(placeholders)
// updatePlaceholder(placeholderId, fields)
// deletePlaceholder(placeholderId)
// savePhoneModuleCard({ moduleId, nodeId, type, data })
// deletePhoneModuleCard({ moduleId, nodeId })
```

Every mutation method accepts an optional final `{ correctsOperationId }` options object. Ordinary calls omit it. A correction forwards that exact ID to the one underlying runtime `stage()` or `commitNow()` input; the adapter never infers a correction from a matching key.

Prove IDs are allocated outside `apply`, inputs are cloned, missing records return stable invalid errors, unknown fields survive, and each public structural call creates one `commitNow()` operation. Add one field and one structural correction test that select an ID from `runtime.recoveryMaterial().correctableOperationIds`, resolve its exact operation from `pendingOperations`, and assert the adapter forwards only that ID. A later pending ID must never be offered as a target.

Run:

```powershell
node --test tests/article-save-adapter.test.mjs tests/article-atomic-save.test.mjs
```

Expected RED: adapter is absent.

- [ ] **Step 2: Encode atomic invariants**

Tests and implementation must enforce:

- `replaceChoices()` replaces the complete choices array once; it does not call add/update/delete loops.
- `deleteChapter()` removes the chapter once, moves affected nodes to the first remaining chapter, or removes/clears their chapter ID when none remains.
- `savePhoneModuleCard()` creates or updates the module and its node card reference in one operation.
- `deletePhoneModuleCard()` removes module and card reference in one operation.
- Phone-module operations declare `consumes: ["node:<nodeId>:content"]`, so pending body content applies first and structural code reads that newest candidate content.
- Deleting a horizontal-rule/card DOM element becomes a real `updateNode()`/module operation; no DOM-only deletion remains.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests and the global verification loop. Commit:

```powershell
git add js/article-save-adapter.js tests/article-save-adapter.test.mjs tests/article-atomic-save.test.mjs
git commit -m "feat(editor): define atomic article mutations"
```

---

### Task 16: Wire article sessions, body input, and status behind the flag

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `js/app.js`
- Modify: `tests/article-editor-mobile-shell.test.mjs`
- Create: `tests/article-save-lifecycle.test.mjs`
- Modify: `tests/article-body-input.test.mjs`

**Behavior:** The reliable branch opens a work runtime before enabling editing, mounts the shared status view, replaces per-character synchronous database writes with staged body content, and owns all page listeners/timers through route cleanup. The production flag remains false.

- [ ] **Step 1: Write RED lifecycle tests**

With injected flags/runtime/controller factories, prove:

- false flag follows the current render/write path;
- true flag does not enable contenteditable until the work lock is acquired;
- same-work lock failure renders read-only owner/takeover choices and preserves export;
- unsupported Web Locks renders read-only copy and never falls back to legacy writing;
- ordinary input updates DOM/local candidate immediately but does not commit before debounce;
- IME intermediate events do not stage writes and final composition text stages once;
- navigation requested during IME composition waits for `compositionend`, stages the final text, freezes the controller, then drains before accepting the route;
- switching nodes and `refreshEditor()` freeze input and await `drain()` before replacing DOM;
- status success appears only after verified runtime resolution;
- route cleanup unregisters listeners, status subscription, timers, and runtime exactly once;
- `visibilitychange` to hidden refreshes the lease and starts a best-effort flush; becoming visible rechecks native lock, owner/lease, generation, and work token before enabling edits;
- pagehide/pageshow call runtime suspend/resume and a generation mismatch leaves the page read-only;
- `error-unknown`, `conflict`, `mutation-lease-lost`, and `mutation-lock-unavailable` disable further editable controls while preserving copy/export/recovery actions;
- `error-invalid` correction shows only operations named by frozen `correctableOperationIds`, requires an explicit user selection, and forwards that exact operation ID through the article adapter without calling `retry()`;
- remaining recoverable data or a composing input installs `beforeunload`; clean/disposed state removes it.

Run:

```powershell
node --test tests/article-save-lifecycle.test.mjs tests/article-body-input.test.mjs tests/article-editor-mobile-shell.test.mjs
```

Expected RED: editor still writes every input synchronously and lacks runtime lifecycle.

- [ ] **Step 2: Wire the reliable branch without changing the false branch**

Make `renderEditor()` return/await a Promise only through the async-capable router. Create a small exported `createArticleEditorRuntimeController()` used by JSDOM tests. In the true branch, all body mutations call `articleSaveAdapter.stageNodeContent()`; never call `updateNode()` directly. Mount status in both desktop and mobile shells without duplicating the live region. Wire `onCorrectInvalid` to present only operations whose IDs occur in ordinary recovery `correctableOperationIds`; after the user selects one and edits its owning control/form, the controller calls the matching adapter method with `{ correctsOperationId: selected.id }`. It never auto-selects by key, exposes a later pending ID, or calls `retry()` for invalid state.

The takeover button appears only when owner metadata is older than 60 seconds, includes explicit confirmation, and reopens the whole runtime with `takeover: true`; it does not mutate heartbeat metadata itself.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests plus outline/drag/mobile regressions and the global verification loop:

```powershell
node --test tests/article-save-lifecycle.test.mjs tests/article-body-input.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-outline-accessibility.test.mjs tests/article-phone-module-pointer-drag.test.mjs
```

Commit:

```powershell
git add js/pages/editor.js js/app.js tests/article-editor-mobile-shell.test.mjs tests/article-save-lifecycle.test.mjs tests/article-body-input.test.mjs
git commit -m "feat(editor): stage reliable article input"
```

---

### Task 17: Migrate ordinary article fields and their forms

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `tests/article-save-adapter.test.mjs`
- Modify: `tests/article-save-lifecycle.test.mjs`
- Create: `tests/article-form-drafts.test.mjs`

**Behavior:** Under the true test branch, work/editor settings, node create/update/delete, horizontal-rule deletion, scenes, and placeholders use the article adapter. Their unconfirmed forms register with the form-draft registry. Chapters, choices, and phone-module cards remain for Task 19 so this commit stays reviewable.

- [ ] **Step 1: Add RED source and behavior tests**

Exercise work/editor settings, nodes, scenes, and placeholders and assert exactly one matching adapter call with zero injected legacy helper calls. Rendering settings must produce zero writes. Dirty settings/scene/placeholder forms block navigation; Save validates, awaits its adapter call and `drain()`; Continue retains DOM/focus; only Discard clears. For one invalid ordinary field, prove the correction chooser accepts only `correctableOperationIds`, passes the user-selected ID into that same adapter method, and does not expose or overwrite a later same-key draft.

Run:

```powershell
node --test tests/article-save-adapter.test.mjs tests/article-save-lifecycle.test.mjs tests/article-form-drafts.test.mjs
```

Expected RED: these ordinary paths still call synchronous `data.js` mutations or write during rendering.

- [ ] **Step 2: Replace only the named ordinary paths**

Move success feedback after verified Promise fulfillment. A failed operation leaves its form/DOM connected and forwards the runtime snapshot to persistent status. Do not touch chapter, choice, or phone-module-card handlers in this task.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused command, article mobile/outline regressions, and the global verification loop. Commit:

```powershell
git add js/pages/editor.js tests/article-save-adapter.test.mjs tests/article-save-lifecycle.test.mjs tests/article-form-drafts.test.mjs
git commit -m "refactor(editor): migrate article field writes"
```

---

### Task 18: Make generic and phone-module modal close Promise-aware

**Files:**
- Modify: `js/app.js`
- Modify: `js/phone-modal-lifecycle.js`
- Modify: `js/phone-module-draft.js`
- Modify: `tests/phone-modal-lifecycle.test.mjs`
- Modify: `tests/phone-module-draft.test.mjs`
- Create: `tests/app-modal-lifecycle.test.mjs`

**Behavior:** A modal remains connected while an async close guard saves. Repeated close attempts are ignored. Failure or false keeps the modal open and restores focus. Removal and after-close run once only after successful fulfillment. Existing synchronous callers keep their boolean behavior.

- [ ] **Step 1: Write RED modal tests**

Use this exact compatible contract:

```js
createPhoneModalCloseController({
  beforeClose,
  remove,
  afterClose,
  onError,
  restoreFocus,
})
// close(reason): boolean | Promise<boolean>
```

Test synchronous success/false/throw, Promise pending duplicate close, resolved success, resolved false, rejection followed by successful retry, single removal, focus restoration callback, and propagation of the actual Promise through page request-close functions.

For module drafts, test:

```js
commit(data): SavedModule | null | Promise<SavedModule | null>
beforeClose(): false | Result | Promise<false | Result>
```

Draft disposal and `onSaved` happen only after fulfilled non-null save. Rejection/null reports error, keeps the draft, keeps modal open, and allows retry. Empty drafts retain the current synchronous disposal behavior.

Run:

```powershell
node --test tests/app-modal-lifecycle.test.mjs tests/phone-modal-lifecycle.test.mjs tests/phone-module-draft.test.mjs
```

Expected RED: current controllers remove first or treat a Promise as truthy success.

- [ ] **Step 2: Implement compatible thenable handling**

Detect thenables explicitly. During pending state, do not call `remove`, `afterClose`, `draft.dispose`, `onSaved`, or success toast. On rejection reset state to open and rethrow after invoking injected `onError`/focus restoration. Preserve `modal(title, bodyHtml, footerHtml, onClose)` for current synchronous callers; additionally accept `{ beforeClose, afterClose, onError, restoreFocus }` as the fourth argument for guarded callers. Both the close button and overlay route through one controller before DOM removal.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests plus phone modal regressions and the global verification loop:

```powershell
node --test tests/app-modal-lifecycle.test.mjs tests/phone-modal-lifecycle.test.mjs tests/phone-module-draft.test.mjs tests/phone-app-modal.test.mjs tests/phone-app-modal-layout.test.mjs tests/phone-app-back-standalone.test.mjs
```

Commit:

```powershell
git add js/app.js js/phone-modal-lifecycle.js js/phone-module-draft.js tests/app-modal-lifecycle.test.mjs tests/phone-modal-lifecycle.test.mjs tests/phone-module-draft.test.mjs
git commit -m "feat(modal): await guarded close actions"
```

---

### Task 19: Migrate atomic article structures

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `tests/article-save-adapter.test.mjs`
- Modify: `tests/article-atomic-save.test.mjs`
- Modify: `tests/article-save-lifecycle.test.mjs`
- Modify: `tests/article-form-drafts.test.mjs`
- Modify: `tests/article-phone-module-pointer-drag.test.mjs`

**Behavior:** Chapters, complete choice replacement, and phone-module card create/update/delete each become one durable runtime commit and consume pending node content where required. After this task, the true article branch has zero mutating `data.js` calls.

- [ ] **Step 1: Add RED structural integration tests**

Prove chapter deletion, complete choice replacement, and each phone-module card operation call one adapter method and one database commit; pending body content is preserved first; failure leaves no partial candidate and keeps the modal/DOM; dirty chapter/choice/module forms use save/discard/continue; success toast occurs only after verification. For one invalid structural operation, explicitly select its ID from `correctableOperationIds` and prove the controller passes it through the owning adapter's correction options without exposing later IDs or implicitly replacing any sibling operation. Add a source/DI assertion that every mutating legacy article helper receives zero calls in the reliable branch.

Run:

```powershell
node --test tests/article-save-adapter.test.mjs tests/article-atomic-save.test.mjs tests/article-save-lifecycle.test.mjs tests/article-form-drafts.test.mjs tests/article-phone-module-pointer-drag.test.mjs
```

Expected RED: these three structural families still use multi-write or synchronous helpers.

- [ ] **Step 2: Replace only structural paths**

Route chapters, choices, and phone-module cards through the Task 15 adapter and the Promise-aware close behavior completed in Task 18. For article-embedded phone modules, keep draft field blur updates synchronous in memory so the close snapshot contains the last focused value; only the final card/module commit is async and atomic. Preserve current UI behavior, drag cancellation, preallocated IDs, and virtual phone draft semantics.

- [ ] **Step 3: Verify GREEN and commit**

Run all article tests and the global verification loop. Commit:

```powershell
git add js/pages/editor.js tests/article-save-adapter.test.mjs tests/article-atomic-save.test.mjs tests/article-save-lifecycle.test.mjs tests/article-form-drafts.test.mjs tests/article-phone-module-pointer-drag.test.mjs
git commit -m "refactor(editor): migrate atomic structures"
```

---

### Task 20: Add scoped real-phone access while preserving virtual drafts

**Files:**
- Create: `js/phone-save-adapter.js`
- Modify: `js/phone-work-access.js`
- Modify: `tests/phone-work-access.test.mjs`
- Create: `tests/phone-scoped-mutations.test.mjs`

**Behavior:** `phone-draft:*` remains clone-isolated, synchronous, and shallow-patched exactly as today. A real work under the reliable branch rejects `{ phoneData: wholeSnapshot }` and accepts only scoped mutations through its registered work runtime.

- [ ] **Step 1: Write RED access and token tests**

Cover:

- draft creation, snapshot cloning, sync update return value, collision suffix, and dispose remain byte-for-byte compatible;
- `registerPhoneWorkRuntime(workId, runtime)` rejects a duplicate registration and returns idempotent unregister;
- real-work read returns a clone from the registered runtime;
- real-work `updatePhoneWork(id, { phoneData })` throws `LocalDatabaseError` with `code: "mutation-invalid"` and `details.reason: "whole-phone-snapshot-disabled"` when reliable mode is injected true;
- false mode delegates to current `updateStoredWork` unchanged;
- scope token covers the union of writes/reads, sorts field names, and distinguishes absent from `undefined`, empty array, and null;
- token mismatch produces `mutation-conflict` with zero runtime commits;
- `apply()` receives latest candidate `phoneData`;
- a mutation changing any field outside `scope.writes` is rejected with `code: "mutation-invalid"` and `details.reason: "out-of-scope-write"`;
- returned token reflects the verified committed scope;
- a per-panel queue serializes rapid saves and passes the first result token into the second call.
- an invalid real-work panel correction accepts one explicitly selected recovery operation ID, carries it through the queue, and forwards it unchanged to runtime input; an ordinary mutation never invents that field.

Run:

```powershell
node --test tests/phone-work-access.test.mjs tests/phone-scoped-mutations.test.mjs
```

Expected RED: registration, scope reads/mutations, and whole-snapshot rejection do not exist.

- [ ] **Step 2: Implement the adapter contracts**

Export from `phone-save-adapter.js`:

```js
createPhoneScopeToken(phoneData, scope)
assertPhoneMutationScope(before, after, scope)
createPhonePanelMutationQueue({ readScope, mutateScope })
```

Export from `phone-work-access.js`:

```js
registerPhoneWorkRuntime(workId, runtime)
readStoredPhoneWorkScope(workId, scope)
mutateStoredPhoneWork(workId, mutation, { correctsOperationId = undefined } = {})
```

The runtime operation key is `phone:<sorted-write-fields>`. Preallocated record IDs live in the payload, never inside `apply()`. The panel queue accepts the same optional correction options object and carries its exact ID to `mutateStoredPhoneWork()` and then the runtime operation; it never derives correction from scope/key equality. Update the in-memory expected scope token only after verified resolution; failure retains the last confirmed token and queue order.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests and the global verification loop. Commit:

```powershell
git add js/phone-save-adapter.js js/phone-work-access.js tests/phone-work-access.test.mjs tests/phone-scoped-mutations.test.mjs
git commit -m "feat(phone): scope real work mutations"
```

---

### Task 21: Migrate phone shell and core panels behind the flag

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-scoped-mutations.test.mjs`
- Modify: `tests/phone-icon-pointer-drag.test.mjs`
- Modify: `tests/phone-editor-grid.test.mjs`
- Modify: `tests/phone-editor-viewport.test.mjs`

**Behavior:** The reliable test branch opens/registers one shared work runtime and migrates shell normalization, app layout, customize, profile, and contacts to owned scopes. The production flag remains false and the draft branch stays synchronous.

- [ ] **Step 1: Add RED scope-routing tests**

Assert exact ownership:

| Panel | `writes` | `reads` |
|---|---|---|
| App layout and icon drag | `apps` | none |
| Customize | `skin`, `apps` | none |
| Profile | `skin` | none |
| Contacts | `contacts` | none |

Test each create/update/delete action once, including two rapid operations using the advanced token. Test that `renderPhoneEditor()` performs zero writes: legacy normalization moves into explicit reliable-session initialization or remains in-memory until the first owned mutation.

Also test the real-phone entry states: a second tab for the same phone work is read-only with recheck/return actions; a valid lease never exposes takeover; a 60-second stale lease exposes takeover only after explicit confirmation; a missing Web Locks API is read-only, keeps existing-work export available, and never falls back to whole-snapshot writing.

Run:

```powershell
node --test tests/phone-scoped-mutations.test.mjs tests/phone-icon-pointer-drag.test.mjs tests/phone-editor-grid.test.mjs tests/phone-editor-viewport.test.mjs
```

Expected RED: phone page still writes whole `phoneData`, including during rendering.

- [ ] **Step 2: Wire the reliable controller branch**

Export a testable `createPhoneEditorRuntimeController()` that accepts flags/runtime/access factories. When true, acquire/register runtime before enabling controls and unregister it through router cleanup. For drafts or false mode, retain current direct synchronous work access.

Replace only the panels listed in this task. Each handler snapshots its scope on open, uses its own serialized queue, applies to latest candidate data, preallocates IDs, and updates local display only from successful returned data. Do not capture and reassign old `pd`, `apps`, `contacts`, or `skin` objects to a real work.

- [ ] **Step 3: Verify GREEN and commit**

Run focused phone shell tests and the global verification loop. Commit:

```powershell
git add js/pages/phone.js tests/phone-scoped-mutations.test.mjs tests/phone-icon-pointer-drag.test.mjs tests/phone-editor-grid.test.mjs tests/phone-editor-viewport.test.mjs
git commit -m "refactor(phone): scope shell and core edits"
```

---

### Task 22: Migrate phone social apps behind the flag

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-scoped-mutations.test.mjs`
- Modify: `tests/phone-app-modal.test.mjs`
- Modify: `tests/phone-app-modal-layout.test.mjs`
- Modify: `tests/phone-app-back-standalone.test.mjs`

**Behavior:** Messages/chat/moments, forum/forum NPCs, and memo use declared real-work scopes and per-panel queues. Media, browser, shopping, and reading flow remain for Task 23.

- [ ] **Step 1: Add RED social scope tests**

| App | `writes` | `reads` |
|---|---|---|
| Messages overview / moments | `chats`, `moments` | `contacts` |
| Chat detail | `chats` | `contacts` |
| Forum | `forumPosts`, `forumNpcs` | `contacts` |
| Memo | `memos` | `contacts` |

For each family, exercise create/update/delete, latest-candidate preservation, stale contact-token conflict, rapid same-panel serialization, preallocated IDs across retry, out-of-scope rejection, and no whole `phoneData` assignment.

Run:

```powershell
node --test tests/phone-scoped-mutations.test.mjs tests/phone-app-modal.test.mjs tests/phone-app-modal-layout.test.mjs tests/phone-app-back-standalone.test.mjs
```

Expected RED: the three social editors still persist captured snapshots.

- [ ] **Step 2: Replace only social app writes**

Keep modal DOM, responsive layout, back behavior, and draft semantics unchanged. Move success feedback after verified fulfillment. Failure keeps the editor/form open, restores focus, and forwards persistent status. Do not modify gallery, browser, shopping, or reading-flow handlers.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused command and global verification loop. Commit:

```powershell
git add js/pages/phone.js tests/phone-scoped-mutations.test.mjs tests/phone-app-modal.test.mjs tests/phone-app-modal-layout.test.mjs tests/phone-app-back-standalone.test.mjs
git commit -m "refactor(phone): scope social app edits"
```

---

### Task 23: Migrate phone media, utility, and reading-flow apps

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-scoped-mutations.test.mjs`
- Modify: `tests/phone-app-modal.test.mjs`
- Modify: `tests/phone-app-modal-layout.test.mjs`
- Modify: `tests/phone-app-back-standalone.test.mjs`

**Behavior:** Gallery, browser history, shopping, and reading-flow settings complete the scoped real-phone migration. After this task, the true phone branch has no whole-snapshot writer.

- [ ] **Step 1: Add RED utility scope tests**

| App | `writes` | `reads` |
|---|---|---|
| Gallery | `photos`, `albums` | `contacts` |
| Browser | `browserHistory` | `contacts` |
| Shopping | `shoppingItems` | `contacts` |
| Reading flow | `readingFlow` | `contacts`, `memos`, `shoppingItems`, `forumPosts`, `moments`, `chats`, `photos`, `browserHistory` |

For each family, exercise create/update/delete or rebuild, latest-candidate preservation, stale dependency conflict, queue token advancement, preallocated IDs, and out-of-scope rejection. `readingFlow` remains valid even though it is not in `PHONE_COLLECTIONS`; the scope validator must not use that schema list as its writable-field allowlist.

Run:

```powershell
node --test tests/phone-scoped-mutations.test.mjs tests/phone-app-modal.test.mjs tests/phone-app-modal-layout.test.mjs tests/phone-app-back-standalone.test.mjs
```

Expected RED: these four handlers still persist captured snapshots or rebuild from stale collections.

- [ ] **Step 2: Replace only utility and flow writes**

Use the same queue/error/focus semantics proven in Task 22. Add a final source/DI assertion that the reliable phone branch never calls real-work `updatePhoneWork(id, { phoneData })`. Leave modal lifecycle, drag rollback, route lifecycle, and shared status work for Task 24.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused command, `tests/phone-work-access.test.mjs`, and global verification loop. Commit:

```powershell
git add js/pages/phone.js tests/phone-scoped-mutations.test.mjs tests/phone-app-modal.test.mjs tests/phone-app-modal-layout.test.mjs tests/phone-app-back-standalone.test.mjs
git commit -m "refactor(phone): scope utility app edits"
```

---

### Task 24: Finish phone modal, lifecycle, and save recovery

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Modify: `tests/phone-module-draft.test.mjs`
- Modify: `tests/phone-app-modal.test.mjs`
- Modify: `tests/phone-icon-accessibility.test.mjs`
- Modify: `tests/phone-editor-viewport.test.mjs`

**Behavior:** Real-work phone modals await durable commits, the shared status/recovery UI is visible, and navigation/page lifecycle drains or blocks safely. Virtual phone drafts remain synchronous. Drag persistence remains for Task 25.

- [ ] **Step 1: Add RED async close and lifecycle tests**

Prove:

- pending real-work modal save leaves the modal connected and close controls single-flight;
- failed save vetoes close, keeps draft data, restores modal focus, and shows persistent status without success toast;
- retry success disposes once and closes once;
- `requestPhoneAppModalClose()` and `exitPhoneAppEditor()` return/await the actual boolean or Promise;
- phone route guard waits for runtime drain and dirty modal forms; pagehide/pageshow suspend/resume; beforeunload remains while recovery material exists.
- phone `visibilitychange` hidden refreshes the lease and starts best-effort flush, while visible revalidates native lock, owner/lease, generation, and scope baseline before controls are enabled;
- lock-unavailable, work-locked, conflict, unknown, and lease-lost phone states keep the virtual phone content readable but disable real-work mutations and expose their distinct shared-status actions.
- error-invalid exposes only phone operations named by `correctableOperationIds`; after explicit user selection, the owning panel resubmits current valid input with `{ correctsOperationId: selected.id }`, while later pending IDs are hidden, cancel performs no mutation, and ordinary retry is never used.

Run:

```powershell
node --test tests/phone-modal-lifecycle.test.mjs tests/phone-module-draft.test.mjs tests/phone-app-modal.test.mjs tests/phone-icon-accessibility.test.mjs tests/phone-editor-viewport.test.mjs
```

Expected RED: page callers discard Promises and phone has no shared recovery lifecycle.

- [ ] **Step 2: Complete page integration**

Mount `save-status-view` once in the phone editor shell. Register phone modal forms in the shared form-draft registry. Route navigation through `drain()` and the same save/discard/continue choices as article. Wire `onCorrectInvalid` to a user-selected operation restricted by ordinary recovery `correctableOperationIds`, then pass that exact ID through the panel queue and phone adapter. Use runtime backup for phone failures. Ensure async modal failure never falls back to toast-only reporting.

- [ ] **Step 3: Verify GREEN and commit**

Run the focused modal/lifecycle/mobile suite and global verification loop:

```powershell
node --test tests/phone-modal-lifecycle.test.mjs tests/phone-module-draft.test.mjs tests/phone-app-modal.test.mjs tests/phone-app-modal-layout.test.mjs tests/phone-app-back-standalone.test.mjs tests/phone-icon-accessibility.test.mjs tests/phone-editor-viewport.test.mjs tests/article-editor-mobile-shell.test.mjs
```

Commit:

```powershell
git add js/pages/phone.js css/styles.css tests/phone-module-draft.test.mjs tests/phone-app-modal.test.mjs tests/phone-icon-accessibility.test.mjs tests/phone-editor-viewport.test.mjs
git commit -m "feat(phone): protect async editor lifecycle"
```

---

### Task 25: Make phone icon drag commits failure-safe

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-icon-pointer-drag.test.mjs`
- Modify: `tests/article-phone-module-pointer-drag.test.mjs`

**Behavior:** A changed phone icon drop makes one scoped `apps` commit. Unchanged/cancelled gestures write nothing. A failed async commit restores both dragged and displaced icons and permits retry without weakening the already-correct article phone-module drag controller.

- [ ] **Step 1: Add RED async drag tests**

Prove changed-cell one-commit behavior; same-cell zero-write; pointercancel, lostpointercapture, blur, rerender/reset, and late-pointerup zero-write restoration; blocking a second drag while commit is pending; failure rollback/focus/error UI; and unchanged article drag cancellation invariants.

Run:

```powershell
node --test tests/phone-icon-pointer-drag.test.mjs tests/article-phone-module-pointer-drag.test.mjs
```

Expected RED: real-phone drag does not yet await/rollback its scoped commit.

- [ ] **Step 2: Implement only drag persistence**

Capture a deep DOM/data rollback snapshot at drag start. Submit one `apps` scoped mutation only for a structurally changed valid cell. Keep the interaction locked until settlement. Restore the snapshot on rejection and forward persistent error state; cancellation never enters the mutation queue.

- [ ] **Step 3: Verify GREEN and commit**

Run focused tests, phone accessibility/grid tests, and global verification loop. Commit:

```powershell
git add js/pages/phone.js tests/phone-icon-pointer-drag.test.mjs tests/article-phone-module-pointer-drag.test.mjs
git commit -m "fix(phone): rollback failed icon drags"
```

---

### Task 26: Prove and seal the global local-write boundary

**Files:**
- Create: `tests/local-write-boundary.test.mjs`
- Modify: `tests/reliable-save-boundary.test.mjs`
- Modify: `tests/storage.test.mjs`
- Modify: `js/storage.js`
- Modify: `js/data.js`
- Modify: `js/app.js`
- Modify: `js/pages/home.js`
- Modify: `js/pages/new.js`
- Modify: `js/pages/editor.js`
- Modify: `js/pages/phone.js`

**Behavior:** Before activation, prove that every true-branch database mutation uses the guarded runtime/restore/home path, and every legacy path is blocked before storage mutation whenever reliable mode is true. Keep the production default false in this task.

- [ ] **Step 1: Write the RED static boundary test**

The test reads production source and asserts:

- only `storage.js`, `local-database-mutation.js`, and locked restore/reset code can call `setItem()`/`removeItem()` for `LOCAL_DATABASE_KEY`;
- legacy storage writers call `assertLegacyWritesAllowed()` before any mutation;
- `data.js` imports only the explicitly named legacy writer and cannot bypass its guard;
- reliable home/new controllers import `home-work-mutations.js`;
- reliable article controller imports `article-save-adapter.js` and has no direct true-branch legacy mutation call;
- reliable phone controller uses scope mutation APIs and rejects whole `phoneData` replacement;
- restore and corrupt reset true branches call only locked async functions;
- all page controllers consult the same `reliableLocalWrites` name;
- no URL/localStorage/runtime flag override exists;
- all page controller tests inject their intended mode and mutation dependencies explicitly instead of inheriting the production default or invoking a globally guarded legacy writer;
- `FEATURE_FLAGS.reliableLocalWrites` is still literal `false`.

Run:

```powershell
node --test tests/local-write-boundary.test.mjs tests/reliable-save-boundary.test.mjs
```

Expected RED: remaining legacy aliases/imports or unguarded storage sites are reported with exact filenames.

- [ ] **Step 2: Remove only discovered bypasses**

Rename the low-level fallback to `writeLocalDatabaseLegacy()` and keep it guarded. Ordinary pages may retain false-branch calls to legacy `data.js` helpers for rollback, but true branches must never reach them. Delete unused mutating imports from `app.js` and any page where migration made them unnecessary. Do not flip the flag.

Move `tests/storage.test.mjs` mutation assertions off default calls to the now-dead-at-activation legacy writer: pure validation/serialization stays there, atomic writes stay in `local-database-mutation.test.mjs`, and locked restore/reset stays in `local-database-restore-locks.test.mjs`. Keep one source/guard assertion proving the legacy function throws before mutation in reliable mode. Update page controller tests so their false branches use injected fake legacy mutations and their true branches use injected reliable mutations; no post-activation test may reach the default legacy writer. This prevents the final flag flip from changing a fixture's intended code path while retaining false-branch controller compatibility coverage.

Run an explicit source audit:

```powershell
rg -n "tuuru_works|LOCAL_DATABASE_KEY|writeLocalDatabase|setItem\(|removeItem\(|updateWork\(|phoneData" js
```

Classify every match in the commit message body or task notes as read-only, guarded legacy fallback, atomic commit, locked restore/reset, or unrelated storage key. Any unclassified database writer stops activation.

- [ ] **Step 3: Verify GREEN and commit**

Run all storage, home, article, phone, restore, and boundary suites, then the global verification loop:

```powershell
node --test tests/local-*.test.mjs tests/reliable-save-boundary.test.mjs tests/home-*.test.mjs tests/article-*.test.mjs tests/phone-*.test.mjs tests/library-restore-ui.test.mjs tests/storage-recovery-ui.test.mjs
```

Commit:

```powershell
git add js/storage.js js/data.js js/app.js js/pages/home.js js/pages/new.js js/pages/editor.js js/pages/phone.js tests/storage.test.mjs tests/local-write-boundary.test.mjs tests/reliable-save-boundary.test.mjs
git commit -m "refactor(storage): seal legacy write bypasses"
```

---

### Task 27: Activate every reliable writer together and run final regression

**Files:**
- Modify: `js/feature-flags.js`
- Modify: `tests/reliable-save-boundary.test.mjs`
- Modify: `tests/local-write-boundary.test.mjs`

**Behavior:** Flip the single production flag from false to true. Article, phone, home/new, restore, and corrupt reset all change together. No second flag and no mixed production path exists.

- [ ] **Step 1: Change activation expectations and observe RED**

First change the two boundary tests to require literal `true` and to assert every legacy mutation attempt now throws before storage. Run:

```powershell
node --test tests/reliable-save-boundary.test.mjs tests/local-write-boundary.test.mjs
```

Expected RED: the production flag is still false.

- [ ] **Step 2: Flip exactly one production value**

Change only:

```js
export const FEATURE_FLAGS = Object.freeze({ reliableLocalWrites: true })
```

Run boundary tests first. Then run every focused family separately so the failing subsystem is obvious:

```powershell
node --test tests/local-*.test.mjs tests/storage*.test.mjs tests/library-restore-ui.test.mjs
node --test tests/home-*.test.mjs tests/router*.test.mjs
node --test tests/article-*.test.mjs tests/form-draft-registry.test.mjs
node --test tests/phone-*.test.mjs
```

If activation exposes any defect outside these three files, do not expand this commit. Use `apply_patch` to restore exactly the flag and two expectations to their pre-task values and confirm the tree is clean. Then insert a new numbered regression task immediately before activation and renumber activation in the same plan patch. Commit that docs-only amendment with `docs(storage): plan activation regression`, run `npm run verify`, and confirm a clean tree before touching regression code. Implement/test/commit the regression as its own task, then restart the renumbered activation task from a clean tree. If the defect alters a public data format, lock order, recovery meaning, or UI decision, stop and ask the user before adding that task.

- [ ] **Step 3: Verify real-browser locks and product flows**

Start the lock server with the background `Start-Process` command from Task 3, open the localhost result, confirm all seven rows pass, and stop it through `POST /__shutdown`.

Check whether the product ports already belong to a running user session:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8765,5678 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
```

Do not kill or replace an existing listener. For each missing port, start its exact Vite process from the repository and record the printed PID:

```powershell
$node = (Get-Command node).Source
$pidFile = Join-Path $env:TEMP "tuuru-reliable-save-devservers.json"
if (Test-Path -LiteralPath $pidFile) { throw "Stale Tuuru PID file exists: $pidFile" }
$startedServers = @()
foreach ($server in @(
  @{ Port = 8765; Config = "vite.config.ts" },
  @{ Port = 5678; Config = "vite.reader.config.ts" }
)) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $server.Port -ErrorAction SilentlyContinue
  if ($listener) { continue }
  $process = Start-Process -FilePath $node -ArgumentList @("node_modules/vite/bin/vite.js", "--config", $server.Config, "--host", "127.0.0.1") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
  $startedServers += @{ Id = $process.Id; Port = $server.Port }
}
$startedServers | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
$startedServers
```

Confirm readiness before browser inspection:

```powershell
$deadline = (Get-Date).AddSeconds(30)
foreach ($uri in @("http://127.0.0.1:8765/", "http://127.0.0.1:5678/")) {
  while ($true) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $uri
      if ($response.StatusCode -eq 200) { break }
      throw "Unexpected HTTP status: $($response.StatusCode)"
    } catch {
      if ((Get-Date) -ge $deadline) { throw "Vite readiness timed out: $uri" }
      Start-Sleep -Milliseconds 250
    }
  }
}
```

Both must return 200 within 30 seconds. Then manually verify:

1. same article and same real phone work in two tabs: the second page is read-only; a valid lease cannot be stolen; stale takeover requires confirmation;
2. two different works: both edit; rapid alternating saves preserve both;
3. article typing: 600 ms trailing save and 3 s maximum wait; IME saves final text only;
4. choices, chapter delete, and phone-module card create/delete each survive reload as one operation;
5. real phone panels/apps save without overwriting another panel; virtual embedded draft stays synchronous until close;
6. modal save failure stays open; retry works; drag cancellation writes nothing;
7. route/back/navigation with dirty body or form offers the designed choices and preserves DOM on failure;
8. hiding/showing article and phone pages refreshes/revalidates their lease; restore is blocked by an active editor; after editors close it succeeds and an old suspended page cannot write back;
9. quota/readback/conflict simulations expose correct persistent actions and downloadable recovery files;
10. layouts remain usable at 320px, 375px, desktop, soft keyboard viewport, and safe-area insets; keyboard focus and reduced motion remain correct;
11. reader loads article and phone works exported after reliable saves.

After inspection, stop only the processes recorded by this step and remove the temp PID file:

```powershell
$pidFile = Join-Path $env:TEMP "tuuru-reliable-save-devservers.json"
$startedServers = @(Get-Content -LiteralPath $pidFile -Encoding utf8 | ConvertFrom-Json)
foreach ($server in $startedServers) {
  if ($null -eq $server -or $null -eq $server.Id) { continue }
  $process = Get-Process -Id $server.Id -ErrorAction SilentlyContinue
  if ($process) { Stop-Process -Id $server.Id }
}
Remove-Item -LiteralPath $pidFile
```

Leave every pre-existing listener untouched, then confirm no recorded PID remains.

- [ ] **Step 4: Run full verification and commit activation**

Run:

```powershell
npm run verify
git diff --check
git status --short
```

Commit only the flag and the two boundary expectations:

```powershell
git add js/feature-flags.js tests/reliable-save-boundary.test.mjs tests/local-write-boundary.test.mjs
git commit -m "feat(storage): enable reliable local writes"
```

After the commit, rerun all four focused family commands, the Task 3 background browser-harness procedure, `npm run verify`, `git diff --check`, and `git status --short`. The final status must be empty.

## Spec Coverage Checklist

- [ ] Pure local/no network boundary is asserted by source tests and final manual network inspection.
- [ ] Web Locks unavailable means read-only, never heartbeat locking.
- [ ] Lock order and same/different-work behavior are covered in fake and real-browser tests.
- [ ] Owner/lease records, `expiresAt`, 15-second heartbeat, 60-second stale threshold, explicit `steal`, and takeover fencing are tested.
- [ ] Restore generation is persistent, advances before replacement, and invalidates suspended runtimes.
- [ ] One latest-raw database mutation, one `setItem`, exact source check, exact readback, and full validation are tested.
- [ ] Retryable, invalid, unknown, conflict, lease-lost, and disposed states have distinct behavior.
- [ ] Unknown batches are frozen and rechecked without replay.
- [ ] Coordinator generations, immutable payloads, key coalescing, structural consumption, `commitNow`, and stable `drain` are tested.
- [ ] Emergency backup covers valid pending, invalid raw draft, unknown, conflict, and lease-lost branches without overwriting stored work.
- [ ] Other active editor records produce a persistent warning that their in-memory edits are not in this tab's backup.
- [ ] Router latest-target, accepted-URL restoration, guards, async render, and once-only cleanup are tested.
- [ ] Dirty form save/discard/continue and IME navigation behavior are tested.
- [ ] `visibilitychange`, pagehide/pageshow, BFCache resume, and composition-during-navigation paths are tested.
- [ ] Article body debounce/max-wait and every article mutation path use the adapter.
- [ ] Choice replacement, chapter deletion, and phone-module card operations are one atomic commit.
- [ ] Virtual phone drafts remain synchronous/isolated; real phone writes are scope-owned and token fenced.
- [ ] Promise-aware modal and module close does not remove/dispose/toast early.
- [ ] Drag changed/unchanged/cancel/failure invariants are tested.
- [ ] Save status is persistent, accessible, mobile-safe, reduced-motion-safe, and never claims an unverified success.
- [ ] Home/new, restore, reset, article, and phone true branches all migrate before the one final flag flip.
- [ ] Existing reader, export, backup format, mobile shell, accessibility, and full Vite builds pass.

## Rollback Rule

If one atomic improvement commit is harmful, use `git revert <that-commit>` after explaining the impact. Do not manually undo a phase, reset the branch, rewrite history, force-push, or squash. If Task 27 activation reveals a broad architectural problem, revert only the activation commit first; the tested dormant foundations can remain while the issue is investigated.

## Completion Definition

The work is complete only when all 27 top-level tasks and every explicitly split atomic commit (including all four Task 7 commits) are complete, every post-commit verification is recorded as passing, the real-browser lock harness passes, the final production flag is true, the working tree is clean, and no user data path was moved off-device.
