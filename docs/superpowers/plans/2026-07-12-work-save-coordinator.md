# Work Save Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one deterministic, frontend-only save coordinator that batches local work edits, proves exact completion boundaries, and freezes safely on ambiguous writes.

**Architecture:** Keep one public module, `js/work-save-coordinator.js`. A single serial pump moves immutable operations through `pending -> ready -> active -> verified` and never starts parallel storage work. Task 7 is split into two code commits so normal batching races and failure recovery can be reviewed and reverted independently.

**Tech Stack:** Browser ES modules, Node's built-in test runner, injected promises and fake timers, existing Task 6 local mutation contracts.

## Global Constraints

- The feature is entirely local. Do not add `fetch`, accounts, cloud sync, telemetry, a server, or a remote database.
- Keep `FEATURE_FLAGS.reliableLocalWrites === false`; Task 7 is not connected to production pages.
- Create only `js/work-save-coordinator.js` and `tests/work-save-coordinator.test.mjs` during the two code tasks.
- Preserve Task 6 raw bytes and error objects. Never retry a write whose result is unknown.
- Start each code task from a clean worktree, use RED/GREEN, commit atomically, then run focused and full verification.

## 大白话说明

正文先在页面里排队。停笔 600 毫秒就保存；一直输入也最多等 3 秒。插卡片、删章节这类结构操作会立刻把“它之前已经排队的字段”封成一批，之后的新输入只能进下一批，所以旧保存成功不会删掉新输入。

如果浏览器明确说“没写进去”，可以原样重试。如果浏览器说“可能写了，也可能没写”，就立刻停止后续写入，只比较保存前和候选的原始字符串；绝不再执行旧回调。

## Locked Public Contract

```js
createWorkSaveCoordinator({
  commitMutation,
  commitPreparedCandidate,
  recheckUnknown,
  scheduler = { setTimeout, clearTimeout },
  now = Date.now,
  debounceMs = 600,
  maxWaitMs = 3000,
  createOperationId = defaultCreateOperationId,
  onSnapshot,
})
```

`scheduler` contains only `setTimeout(callback, delayMs)` and `clearTimeout(handle)`. `now()` is separate, matching `work-edit-session.js`, and returns a non-negative safe integer. Both delays are non-negative safe integers and `maxWaitMs >= debounceMs`.

The final returned object is frozen and exposes:

```js
{
  stage(input),
  commitNow(input),
  flush(),
  drain(reason),
  retry(),
  recheck(),
  markLeaseLost(error),
  snapshot(),
  recoveryMaterial(),
  subscribe(listener),
  dispose(),
}
```

- `stage()` is synchronous and returns the accepted frozen field operation.
- `commitNow()` returns a Promise for the exact commit result containing its structural generation.
- `flush()` freezes everything accepted at its call boundary and resolves with the commit result that verifies that target, or `null` when there is nothing to save. Two flushes with the same target return the same Promise. If active batch A exists and later field B is already pending, `flush()` waits for A and B serially; it must not report success after A alone.
- `drain()` returns one shared Promise and keeps moving its target until generation, active work, ready batches, and pending fields are stable. It resolves to the current frozen snapshot.
- `retry()` is single-flight and resolves with the verified retry commit result.
- `recheck()` is single-flight and resolves with the exact saved/not-written/conflict recheck result after state is updated.
- `markLeaseLost()` changes state synchronously, is idempotent, and returns the current frozen snapshot.
- `snapshot()` returns the current frozen snapshot object without cloning it.
- `dispose()` changes state synchronously but returns one shared `Promise<FrozenSnapshot>`. That Promise waits for already-started, non-cancellable commit/retry/recheck work to settle. Task 8 must `await coordinator.dispose()` before releasing the work session locks.

After a retry or `recheck()`-saved result verifies the retained batch, the serial pump immediately continues batches that were already accepted behind it. The direct `retry()` / `recheck()` Promise reports its own safety action; callers that must wait for every later edit use `drain()`.

An operation is deeply immutable:

```js
{
  id: "field-1",
  key: "node:n1:content",
  kind: "field" | "structural",
  generation: 1,
  payload: frozenJsonValue,
  consumes: Object.freeze([]),
  apply(work, payload) {},
}
```

Payloads are ordinary JSON values only. Validate and clone them without invoking `toJSON` or accessors, then recursively freeze the clone. `createOperationId(kind)` receives `field`, `structural`, or `batch`; every returned ID is non-empty and unique inside the coordinator. Invalid input does not consume a generation or ID.

A normal frozen batch is:

```js
{
  kind: "mutation",
  id: "batch-1",
  operationIds: Object.freeze(["field-1", "structural-2"]),
  generations: Object.freeze([1, 2]),
  operations: Object.freeze([fieldOperation, structuralOperation]),
}
```

Fields are generation-ordered and a batch contains at most one structural operation, always last. `commitNow()` immediately captures **all** currently pending fields into its batch, not only keys in `consumes`; `consumes` only records which captured field results the structural operation intentionally owns. Later fields cannot enter that frozen batch.

The internal queue is:

```text
activeAction
blockedBatch or callback-free uncertainBatch
readyBatches FIFO
pendingFields Map<key, operation>
flush/commitNow/drain waiters
```

Updating a pending field replaces only that not-yet-frozen field. Order is always sorted by the surviving operation generations; do not rely on `Map.set()` insertion order. Every unverified operation exists in exactly one internal location.

Unknown writes use a different, callback-free envelope:

```js
{
  kind: "unknown",
  id: "batch-1",
  operationIds: Object.freeze(["field-1", "structural-2"]),
  generations: Object.freeze([1, 2]),
  expectedCurrentRaw: "..." | null,
  candidateRaw: "...",
}
```

Only this envelope may be passed to `recheckUnknown()` and `commitPreparedCandidate()`. It contains no `operations` or `apply`, so an uncertain structural change cannot be replayed accidentally.

Injected functions have exact contracts:

```js
commitMutation(frozenMutationBatch)
// => Promise<{ ok: true, operationId: batch.id, raw, database, workToken }>

commitPreparedCandidate(frozenUnknownBatch)
// => Promise<{ ok: true, operationId: batch.id, raw, database, workToken }>

recheckUnknown(frozenUnknownBatch)
// => Promise<
//   { outcome: "saved", result: { raw, database, workToken } }
//   | { outcome: "not-written" }
//   | { outcome: "conflict", result: { raw, database, workToken } }
// >
```

The initial frozen snapshot is exact:

```js
{
  state: "clean",
  pendingCount: 0,
  activeBatchId: null,
  lastSavedAt: null,
  error: null,
  canRetry: false,
  canRecheck: false,
  hasRecoverableCandidate: false,
  generation: 0,
  otherActiveEditors: Object.freeze([]),
  availability: null,
}
```

The only states are `clean`, `dirty`, `saving`, `error-retryable`, `error-invalid`, `error-unknown`, `conflict`, `lease-lost`, and `disposed`. `pendingCount` counts every unverified descriptor across active, blocked/uncertain, ready, and pending locations. `activeBatchId` is the active, blocked, or uncertain batch ID and is otherwise null. `canRetry` and `canRecheck` are true only in their matching error states. `lastSavedAt` changes only after exact verification, using `now()`.

Task 7 keeps `otherActiveEditors` empty and `availability` null; Task 8 wraps these fields with session data. `subscribe()` immediately receives the current snapshot and returns an idempotent unsubscribe. `onSnapshot` behaves like an initial subscription. Identical semantic snapshots are not emitted twice. Observer failures never reclassify a verified save.

Ordinary recovery is frozen `{ kind: "ordinary", pendingOperations }`. Unknown recovery, including a later terminal state, is frozen `{ kind: "unknown", uncertainBatch, laterPendingOperations }`; the uncertain envelope has no callbacks.

Error mapping is context-sensitive:

| Condition | State |
|---|---|
| `mutation-write-failed` or `mutation-read-failed`, `commitState: "unchanged"` | `error-retryable` |
| `mutation-invalid`, `commitState: "unchanged"`, phase `apply` or `validate-candidate` | `error-invalid` |
| `commitState: "unknown"`, or readback/verification failure | `error-unknown` |
| `mutation-conflict`, source/input invalid outside recheck, unknown code, or missing trustworthy commit state | `conflict` |
| `mutation-lease-lost`, `work-locked`, or `mutation-lock-unavailable` | `lease-lost` while retaining the original distinct code |

Any failure thrown by `recheckUnknown()`, including `mutation-invalid` with `commitState: "unknown"`, that does not prove a lease loss or a conflict keeps the coordinator in `error-unknown`. It must never become correctable `error-invalid`.

Waiter settlement is exact. A failed active batch rejects callers waiting for operations inside that batch, plus any `flush()`/`drain()` whose target crossed it. `commitNow()` waiters for later, not-yet-attempted generations stay pending across a retryable/invalid/unknown pause and may resolve after the safe retry/recheck path continues the pump. `conflict`, `lease-lost`, and `disposed` reject every remaining waiter. Coordinator-created errors have stable codes `save-action-unavailable`, `save-lease-lost`, or `save-disposed`; original Task 6 errors keep their original identity and code. Falsy thrown values are retained as `cause` when wrapping is required.

---

### Task 1: Deterministic successful batching

**Files:**
- Create: `js/work-save-coordinator.js`
- Create: `tests/work-save-coordinator.test.mjs`

**Produces:** Immutable operations/batches, structural barriers, exact flush targets, the serial pump, timers, commit-generation waiters, drain, snapshots/subscriptions, and quiescent disposal. Unknown dependency failures fail closed to `conflict` until Task 2 adds the proven recovery mappings.

Task 1 intentionally exposes only the coherent core methods `stage`, `commitNow`, `flush`, `drain`, `snapshot`, `subscribe`, and `dispose`. No production page imports the new module while the rollout flag is closed. Task 2 adds `retry`, `recheck`, `markLeaseLost`, and `recoveryMaterial` only when their complete state semantics exist; do not add placeholder methods.

- [ ] **Step 1: Write RED export, validation, and immutability tests**

Test that the module is initially absent, then prove the exact initial snapshot, frozen public API, deep payload clone/freeze, rejection of accessors/cycles/non-JSON values, unique IDs, and no consumed generation/ID on invalid input.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/work-save-coordinator.test.mjs
```

Expected: FAIL because `js/work-save-coordinator.js` is absent.

- [ ] **Step 3: Implement operations and ready-batch capture**

Use file-local pure helpers for argument validation, JSON cloning/freezing, operation creation, batch creation, and snapshot creation. `commitNow()` freezes current pending fields plus exactly one structural operation immediately. A field staged afterward remains pending for a later batch.

- [ ] **Step 4: Add RED timer and ordering tests, then implement timers**

Prove 599/600 ms, continuous edits at 2999/3000 ms, a quiet/max timer tie causing one write, and a cleared stale callback doing nothing. Prove `A1 -> B2 -> A3` becomes `B2 -> A3`, while `F1 -> structural -> F2` commits `[F1, structural]` and then `F2`.

Use two one-shot timers: quiet resets on each pending field, max starts once for that pending field group. Each callback captures a token; cleared or superseded callbacks are harmless.

- [ ] **Step 5: Add RED concurrency tests, then implement the serial pump**

Prove only one injected commit is in flight; `commitNow()` waits for its own generation; same-target flush calls return the same Promise; flush during active A with already-pending B waits through B; active success cannot clear a later same-key generation; and subscriber re-entry cannot mutate a frozen active batch.

- [ ] **Step 6: Add RED drain and disposal tests, then implement lifecycle**

Prove concurrent drain calls return the same Promise, edits staged during active work cause another serial batch, and drain resolves only after a stable microtask check. `dispose()` must synchronously publish `disposed`, reject waiters/new input, return the same Promise twice, start no new I/O, and remain pending until existing I/O settles.

- [ ] **Step 7: Verify and commit Task 1**

```powershell
node --test tests/work-save-coordinator.test.mjs
npm run verify
git diff --check
git add js/work-save-coordinator.js tests/work-save-coordinator.test.mjs
git commit -m "feat(editor): add deterministic save batching"
node --test tests/work-save-coordinator.test.mjs
npm run verify
git status --short
```

Expected: focused and full verification pass; worktree is clean.

---

### Task 2: Failure recovery and fail-closed terminal states

**Files:**
- Modify: `js/work-save-coordinator.js`
- Modify: `tests/work-save-coordinator.test.mjs`

**Consumes:** Task 1 frozen batches, ready queue, serial pump, exact generation waiters, and quiescent disposal.

**Produces:** Final Task 7 API and all nine final states.

- [ ] **Step 1: Write RED context-sensitive error mapping tests**

Parameterize `mutation-read-failed`, unchanged write failure, candidate invalid, source/input invalid, unknown readback, conflict, lease loss, lock unavailable, and an unclassified exception. Only `apply`/`validate-candidate` invalid may enter `error-invalid`; source/input corruption and missing trustworthy metadata fail closed to `conflict`.

- [ ] **Step 2: Implement blocked batches and safe retry**

An unchanged retry reuses the same frozen batch object, batch ID, and operation IDs. New retryable field input stays behind it. Retry is single-flight. A correctable invalid batch rejects `retry()`; only a same-key, same-kind explicit correction replaces that operation, preserves other operation IDs, and creates a new batch ID. Unrelated operations do not silently discard the invalid item.

- [ ] **Step 3: Write RED unknown/recheck/prepared tests**

Hold the first commit open, stage later generations, then reject it as unknown. Prove later generations remain recoverable, new staging is rejected after unknown is observed, and the uncertain envelope has no `operations`/`apply`.

Cover saved, not-written, conflict, repeated unknown failure, malformed outcome, and lease loss. Saved never replays old apply. Not-written changes to retryable, and the next retry invokes only `commitPreparedCandidate()` with the exact same raw strings/IDs.

- [ ] **Step 4: Implement callback-free unknown recovery**

Destroy the coordinator's replay path to uncertain callbacks when creating the unknown envelope. Keep only the raw envelope plus separately queued later operations. Recheck and prepared retry are each single-flight and share the global one-action-at-a-time gate.

- [ ] **Step 5: Write RED lease, terminal, recovery, and waiter tests**

Prove `markLeaseLost()` during an admitted commit rejects callers immediately but observes a late verified result without reviving state or starting later batches. Prove conflict/lease/dispose settle every commitNow/flush/drain/retry/recheck waiter. Prove ordinary and unknown recovery shapes are frozen and unknown recovery exposes no uncertain callback.

- [ ] **Step 6: Implement terminal epochs and late-result bookkeeping**

Terminal state is monotonic. A late verified result may remove its exact active generations from recovery and update `lastSavedAt`, but cannot change `lease-lost`/`conflict`/`disposed`, schedule a timer, or start another batch. Disposal still waits for the active action's `finally` before its Promise resolves.

- [ ] **Step 7: Verify and commit Task 2**

```powershell
node --test tests/work-save-coordinator.test.mjs
npm run verify
git diff --check
git add js/work-save-coordinator.js tests/work-save-coordinator.test.mjs
git commit -m "feat(editor): add save recovery states"
node --test tests/work-save-coordinator.test.mjs
npm run verify
git status --short
```

Expected: focused and full verification pass; final Task 7 API is complete and worktree is clean.

## Plan Self-Review

- No placeholder or deferred production behavior remains.
- The two code commits are independently reviewable; Task 2 depends only on committed Task 1.
- Task 6 result and error names match the current source, including `mutation-read-failed`.
- `flush()` has a fixed call-boundary target; `drain()` alone has a moving target.
- Structural batches capture fields at `commitNow()` time, not execution time.
- Unknown and prepared paths cannot receive an `apply` callback.
- `dispose()` expresses both immediate closure and asynchronous quiescence.
