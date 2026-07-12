# Work Save Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one deterministic, frontend-only save coordinator that batches local work edits, proves exact completion boundaries, and freezes safely on ambiguous writes.

**Architecture:** Keep one public module, `js/work-save-coordinator.js`. A single serial pump moves immutable operations through `pending -> ready -> active -> verified` and never starts parallel storage work. Task 7 uses one successful-batching commit followed by three recovery commits so ordinary retry, unknown-write recovery, and terminal lifecycle behavior can each be reviewed and reverted independently.

**Tech Stack:** Browser ES modules, Node's built-in test runner, injected promises and fake timers, existing Task 6 local mutation contracts.

## Global Constraints

- The feature is entirely local. Do not add `fetch`, accounts, cloud sync, telemetry, a server, or a remote database.
- Keep `FEATURE_FLAGS.reliableLocalWrites === false`; Task 7 is not connected to production pages.
- Create or modify only `js/work-save-coordinator.js` and `tests/work-save-coordinator.test.mjs` during the four code tasks.
- Preserve Task 6 raw bytes and error objects. Never retry a write whose result is unknown.
- Start each code task from a clean worktree, use RED/GREEN, commit atomically, then run focused and full verification.

## 大白话说明

正文先在页面里排队。停笔 600 毫秒就保存；一直输入也最多等 3 秒。插卡片、删章节这类结构操作会立刻把“它之前已经排队的字段”封成一批，之后的新输入只能进下一批，所以旧保存成功不会删掉新输入。

如果浏览器明确说“没写进去”，可以原样重试。如果浏览器说“可能写了，也可能没写”，就立刻停止后续写入，只比较保存前和候选的原始字符串；绝不再执行旧回调。

如果某一批内容本身不合法，普通“重试”没有意义。页面必须明确指出要替换哪一个旧操作；新操作会换 ID，但沿用原来的排队位置，不会跳过它后面已经排队的修改。

恢复阶段也不会偷偷继续保存：明确失败时只能继续输入普通字段并点重试；内容不合法时只能提交指定纠正；结果不确定时只能复查；冲突、租约丢失或销毁后只能查看和导出恢复材料。

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
  drain(),
  retry(),
  recheck(),
  markLeaseLost(error),
  snapshot(),
  recoveryMaterial(),
  subscribe(listener),
  dispose(),
}
```

- `stage()` is synchronous and returns the accepted frozen field operation. In `error-invalid`, it accepts input only when `input.correctsOperationId` explicitly names a blocked field operation with the same key.
- `commitNow()` returns a Promise for the exact commit result containing its structural generation. In `error-invalid`, it accepts input only when `input.correctsOperationId` explicitly names the blocked structural operation with the same key.
- `flush()` freezes everything accepted at its call boundary and resolves with the commit result that verifies that target, or `null` when there is nothing to save. Two flushes with the same target return the same Promise. If active batch A exists and later field B is already pending, `flush()` waits for A and B serially; it must not report success after A alone.
- `drain()` returns one shared Promise and keeps moving its target until generation, active work, ready batches, and pending fields are stable. It resolves to the current frozen snapshot.
- `retry()` is single-flight and resolves with the verified retry commit result.
- `recheck()` is single-flight and resolves with the exact saved/not-written/conflict recheck result after state is updated.
- `markLeaseLost()` changes state synchronously, is idempotent, and returns the current frozen snapshot.
- `snapshot()` returns the current frozen snapshot object without cloning it.
- `recoveryMaterial()` returns `null` when nothing is recoverable, otherwise one frozen ordinary or unknown recovery record. Ordinary material includes frozen `correctableOperationIds`; it contains exactly the current invalid blocked batch's operation IDs in `error-invalid` and is empty in every other state. It never clones Task 6 result or error objects.
- `dispose()` changes state synchronously but returns one shared `Promise<FrozenSnapshot>`. That Promise waits for already-started, non-cancellable commit/retry/recheck work to settle. Task 8 must `await coordinator.dispose()` before releasing the work session locks.

After a retry or `recheck()`-saved result verifies the retained batch, the serial pump immediately continues batches that were already accepted behind it. The direct `retry()` / `recheck()` Promise reports its own safety action; callers that must wait for every later edit use `drain()`.

Paused-state admission is exact:

| State | Mutating actions allowed |
|---|---|
| `clean`, `dirty`, `saving` | Normal `stage()`, `commitNow()`, `flush()`, and `drain()` |
| `error-retryable` | Field `stage()` queues behind the blocked material; `retry()` performs the only storage action |
| `error-invalid` | Only `stage()` / `commitNow()` with a valid `correctsOperationId` correction |
| `error-unknown` | Only `recheck()` |
| `conflict`, `lease-lost`, `disposed` | Read-only methods and idempotent `dispose()` |

The table lists edit and recovery actions. `markLeaseLost(error)` may synchronously close any non-disposed state and is idempotent afterward. `dispose()` is allowed from every state, may replace another terminal state with `disposed`, and remains idempotent.

Every other disallowed action fails immediately with the current terminal/recovery error or a stable `save-action-unavailable` error. It creates no timer, ID, generation, batch, waiter, or storage call. `flush()` and `drain()` never create a boundary while recovery is paused.

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

Normal operation input must omit `correctsOperationId`. An invalid correction supplies it as a non-empty string. The referenced operation must exist in `blockedBatch` and have the same key and method-implied kind (`stage` means field; `commitNow` means structural). The replacement gets a new operation ID but keeps the referenced generation, the corrected batch gets a new batch ID, and every other operation object/ID is preserved. Keeping the generation prevents a corrected older batch from making a later generation look verified before its own write. Later same-key pending input remains behind the corrected batch and is never replaced implicitly.

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

`activeAction` is the single global storage gate for normal commit, ordinary retry, prepared retry, and recheck. Its internal record contains `{ kind, materialId, publicPromise, completion, epoch }`. Install the record and shared public Promise before calling `now()`, announcing a snapshot, or invoking any injected dependency. Re-entering the same action returns the exact public Promise; a different action fails immediately. `completion` never rejects and settles only after state, recovery, waiter, and late-result bookkeeping finish, so `dispose()` can await real quiescence.

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

An ordinary commit may become unknown only from a recognized Task 6 error whose **own data** `details` contain all of: matching `operationId`, `commitState === "unknown"`, `expectedCurrentRaw` as `string | null`, and `candidateRaw` as a string. Accessors, missing raw values, a mismatched batch ID, top-level lookalike fields, or unrecognized error codes fail closed to `conflict`. Copy the exact raw strings into the frozen envelope once; later mutation of the error object cannot alter recovery.

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

These names are coordinator-level injected adapters, not direct aliases for Task 6 exports. Task 8 closures supply work/session fields required by `commitLocalDatabaseMutation`, `commitPreparedLocalDatabaseCandidate`, and `recheckUnknownLocalDatabaseCommit`. The coordinator passes only the frozen batch/envelope shown above and never adds callbacks to prepared or recheck input.

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

Ordinary recovery is frozen `{ kind: "ordinary", pendingOperations, correctableOperationIds }`. `pendingOperations` contains every ordinary unverified operation in generation order. `correctableOperationIds` contains only the invalid `blockedBatch.operationIds` while state is `error-invalid`; later ready/pending IDs are never eligible and every other state uses the shared frozen empty array. Unknown recovery, including a `not-written` result and any later terminal state, is frozen `{ kind: "unknown", uncertainBatch, laterPendingOperations }`; the uncertain envelope has no callbacks. `not-written` changes the state to `error-retryable`, but retains unknown provenance so `retry()` can invoke only `commitPreparedCandidate()` and can never restore the old `apply` path.

Error mapping is context-sensitive:

| Condition | State |
|---|---|
| `mutation-write-failed` or `mutation-read-failed`, `commitState: "unchanged"` | `error-retryable` |
| `mutation-invalid`, `commitState: "unchanged"`, phase `apply` or `validate-candidate` | `error-invalid` |
| Recognized readback/verification failure with `details.commitState: "unknown"` and complete trusted raw material | `error-unknown` |
| `mutation-conflict`, source/input invalid outside recheck, unknown code, or missing trustworthy commit state | `conflict` |
| `mutation-lease-lost`, `work-locked`, or `mutation-lock-unavailable` | `lease-lost` while retaining the original distinct code |

Task 6 metadata lives under `error.details`, not on the error itself. Classification priority is: recognized lease-loss code; recognized conflict code; recheck special handling; recognized unknown code plus complete raw material; recognized unchanged retryable/invalid mapping; otherwise `conflict`. A forged `commitState` on an unknown code is never trusted.

Any failure thrown by `recheckUnknown()`, including `mutation-invalid` with `commitState: "unknown"`, that does not prove a lease loss or a conflict keeps the coordinator in `error-unknown`. It must never become correctable `error-invalid`. A malformed resolved recheck outcome proves nothing and fails closed to `conflict`.

For `{ outcome: "saved" }`, validate `raw`, `database`, and `workToken` as own data, then let `recheck()` resolve the exact injected outcome. Generation waiters receive a new frozen commit-shaped result built with explicit fields `{ ok: true, operationId: uncertainBatch.id, raw, database, workToken }`; never spread untrusted result fields over `ok` or `operationId`. For `{ outcome: "conflict" }`, the direct `recheck()` owner still resolves the exact outcome after state changes; every other waiter rejects one stable coordinator error whose `cause` is that outcome. For `not-written`, the direct owner resolves the exact outcome, existing generation waiters remain pending for prepared retry, and `snapshot().error` retains the last exact unknown failure for diagnosis.

Waiter settlement is exact. Store waiter kind plus its target generation and owning operation/boundary, not only a generation number. A recoverable failed batch rejects `commitNow()` callers inside that batch and any already-created `flush()`/`drain()` that crossed it. `commitNow()` waiters for later, not-yet-attempted generations stay pending across a retryable/invalid/unknown pause and may resolve after the safe retry/recheck path continues the pump. `conflict`, `lease-lost`, and `disposed` reject every remaining waiter. Coordinator-created errors have stable codes `save-action-unavailable`, `save-lease-lost`, or `save-disposed`; original Task 6 errors keep their original identity and code. Falsy thrown values are retained as `cause` when wrapping is required.

Terminal state is monotonic except that `dispose()` may close an already terminal coordinator. A terminal late success removes only its exact active generations, updates `lastSavedAt`, and never revives or pumps. A terminal late unknown failure must still replace the active mutation batch with its callback-free uncertain envelope before action completion; the terminal error/state stay unchanged. Late unchanged failures retain ordinary recovery. No late result may schedule a timer or storage action.

When external `markLeaseLost()` or `dispose()` closes an active retry/recheck, every public action Promise, including that action's owner Promise, rejects immediately with the terminal error. The internal non-rejecting `completion` still waits for the dependency and late bookkeeping; `dispose()` waits for that completion before its own Promise resolves. The only owner-resolution exception is a recheck that itself returns `{ outcome: "conflict" }`: its owner resolves that exact outcome after terminal state is installed, while all other waiters reject.

---

### Task 1: Deterministic successful batching

**Files:**
- Create: `js/work-save-coordinator.js`
- Create: `tests/work-save-coordinator.test.mjs`

**Produces:** Immutable operations/batches, structural barriers, exact flush targets, the serial pump, timers, commit-generation waiters, drain, snapshots/subscriptions, and quiescent disposal. Dependency failures fail closed to `conflict` until Tasks 2–4 add proven recovery mappings.

Task 1 intentionally exposes only the coherent core methods `stage`, `commitNow`, `flush`, `drain`, `snapshot`, `subscribe`, and `dispose`. No production page imports the new module while the rollout flag is closed. Tasks 2–4 add recovery methods only with their complete state semantics; do not add placeholder methods.

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

### Task 2: Ordinary failure states and retry ledger

**Files:**
- Modify: `js/work-save-coordinator.js`
- Modify: `tests/work-save-coordinator.test.mjs`

**Consumes:** Task 1 frozen batches, serial pump, generation ordering, and terminal epoch foundation.

**Produces:** `error-retryable`, `error-invalid`, typed waiters, blocked ordinary batches, one global action gate, `retry()`, and explicit `correctsOperationId` correction semantics.

- [ ] **Step 1: Write RED mapping and waiter-ledger tests**

Parameterize Task 6 errors using metadata under `error.details`. Prove unchanged read/write failures become retryable; only unchanged `apply`/`validate-candidate` invalid becomes correctable; source/input invalid, conflict, malformed metadata, unknown code, and missing trustworthy commit state fail closed. A recoverable failure rejects the failed batch's `commitNow()` waiter and crossing `flush()`/`drain()`, while a later `commitNow()` waiter remains pending.

- [ ] **Step 2: Implement blocked batches, paused admission, and typed waiters**

Add an explicit pump-paused predicate. While paused, no timer or later ready batch may bypass `blockedBatch`. Record waiter kind and ownership. Install the unified action record before any observer or dependency can re-enter.

- [ ] **Step 3: Write RED retry and correction tests**

Prove retry is single-flight, reuses the exact frozen batch/IDs, retains new field input behind it, and resumes later accepted work only after verification. Test repeat failure and success. Prove field and structural corrections require the exact blocked operation ID and same key/kind, use a new operation and batch ID, keep the original generation, preserve every unrelated operation object/ID, and never replace a later same-key pending descriptor.

- [ ] **Step 4: Implement ordinary retry and explicit correction**

Expose `retry()`. Accept `correctsOperationId` only in `error-invalid`; ordinary inputs must omit it. `retry()` rejects invalid batches. A valid correction rebuilds the blocked batch atomically and resumes it before later work.

- [ ] **Step 5: Verify and commit Task 2**

```powershell
node --test tests/work-save-coordinator.test.mjs
npm run verify
git diff --check
git add js/work-save-coordinator.js tests/work-save-coordinator.test.mjs
git commit -m "feat(editor): add ordinary save retry ledger"
node --test tests/work-save-coordinator.test.mjs
npm run verify
git status --short
```

Expected: focused and full verification pass; the worktree is clean; unknown failures still fail closed until Task 3.

---

### Task 3: Callback-free unknown-write recovery

**Files:**
- Modify: `js/work-save-coordinator.js`
- Modify: `tests/work-save-coordinator.test.mjs`

**Consumes:** Task 2 action gate, blocked material, paused admission, and typed waiter ledger.

**Produces:** `error-unknown`, trusted raw extraction, callback-free uncertain envelopes, `recheck()`, prepared retry, and unknown recovery provenance.

- [ ] **Step 1: Write RED trusted-envelope tests**

Hold the first commit open, accept later generations, then reject it as unknown. Prove only recognized own-data metadata with matching batch ID and exact raw values creates an uncertain envelope. Accessors, top-level lookalikes, missing raw values, wrong IDs, and unrecognized codes fail closed. The envelope is frozen and has no `operations` or `apply`; later operations remain separate and new staging is rejected.

- [ ] **Step 2: Write RED recheck and prepared-retry tests**

Cover saved, not-written, conflict, malformed outcome/result, repeated unknown failure, and falsy failure. Saved never replays old callbacks. Not-written retains unknown recovery and the next retry invokes only `commitPreparedCandidate()` with the exact same envelope. Verify direct recheck result identity, derived generation-waiter results, and exact terminal settlement. Task 4 adds lease-loss behavior for every action kind.

- [ ] **Step 3: Implement callback-free recovery and the shared action gate**

Destroy the uncertain mutation batch's replay path when its outcome becomes unknown. Recheck, prepared retry, ordinary retry, and normal commit share one action record. Same-action re-entry returns the same Promise; cross-action re-entry fails without changing state.

- [ ] **Step 4: Verify and commit Task 3**

```powershell
node --test tests/work-save-coordinator.test.mjs
npm run verify
git diff --check
git add js/work-save-coordinator.js tests/work-save-coordinator.test.mjs
git commit -m "feat(editor): add callback-free unknown recovery"
node --test tests/work-save-coordinator.test.mjs
npm run verify
git status --short
```

Expected: focused and full verification pass; unknown or prepared paths cannot receive callbacks; the worktree is clean.

---

### Task 4: Terminal recovery lifecycle

**Files:**
- Modify: `js/work-save-coordinator.js`
- Modify: `tests/work-save-coordinator.test.mjs`

**Consumes:** Task 3 ordinary/unknown material, shared action completion, and exact waiter settlement.

**Produces:** `markLeaseLost()`, `recoveryMaterial()`, final terminal/late-result semantics, quiescent disposal for every action kind, and the final Task 7 API.

- [ ] **Step 1: Write RED recovery and lease tests**

Prove ordinary, unknown, not-written, and terminal recovery shapes are deeply frozen and generation-ordered. In `error-invalid`, `correctableOperationIds` equals only the invalid blocked batch IDs even when later ready/pending operations exist; outside that state it is empty. `markLeaseLost()` is synchronous and idempotent, preserves the original distinct error, and immediately rejects every public commit/retry/recheck owner and waiter. A recheck that itself returns conflict remains the documented owner-resolution exception.

- [ ] **Step 2: Write RED late-result and disposal tests**

Late saved removes only exact generations and updates time without reviving state. Late unchanged retains ordinary material. Late unknown converts active callbacks to a callback-free envelope while keeping terminal state/error. No late result starts a timer, batch, or action. `dispose()` publishes synchronously, returns one Promise under observer re-entry, and waits through action `completion` and bookkeeping.

- [ ] **Step 3: Implement terminal lifecycle and final recovery API**

Add `markLeaseLost()` and `recoveryMaterial()`. Settle the direct recheck-conflict owner separately from all other terminal waiters. Ensure `dispose()` may close an already terminal coordinator but no other terminal state can be revived or replaced.

- [ ] **Step 4: Verify and commit Task 4**

```powershell
node --test tests/work-save-coordinator.test.mjs
npm run verify
git diff --check
git add js/work-save-coordinator.js tests/work-save-coordinator.test.mjs
git commit -m "feat(editor): finalize terminal save lifecycle"
node --test tests/work-save-coordinator.test.mjs
npm run verify
git status --short
```

Expected: focused and full verification pass; final Task 7 API and all nine states are complete; the worktree is clean.

## Plan Self-Review

- No placeholder or deferred production behavior remains.
- The four code commits are independently reviewable; each recovery task depends only on the committed task before it.
- Task 6 result and error names match the current source, including `mutation-read-failed`.
- `flush()` has a fixed call-boundary target; `drain()` alone has a moving target.
- Structural batches capture fields at `commitNow()` time, not execution time.
- Unknown and prepared paths cannot receive an `apply` callback.
- `dispose()` expresses both immediate closure and asynchronous quiescence.
