# Phone Chat Choice Branch Image Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add “当前阅读分支 / 所有选项分支” modes to the reader phone-image export so every reachable authored chat-reply route can be rendered into its own independently paginated PNG files with a readable branch name.

**Architecture:** Keep the existing screenshot/pagination pipeline unchanged and add a pure, side-effect-free chat branch enumerator to the phone story state model. In all-branches mode, expand only chat export jobs: each chat route receives a detached `phoneChoiceSelections` map, is rendered through `openReaderChat`, and is captured as a separate job. Other phone modules continue to export once. Current-branch mode remains the default and preserves today's filenames and behavior.

**Tech Stack:** Vanilla JavaScript ES modules, existing phone story-state helpers, JSDOM/node:test, Vite/TypeScript build, existing `html-to-image` + `fflate` export pipeline.

## Global Constraints

- Scope is authored chat message choices persisted in `phoneChoiceSelections`. Do not enumerate Moment/forum thread-choice runtimes or unsupported choices nested inside generated follow-up messages.
- A branch is a maximal reachable route inside one chat, given the reader's current selections outside that chat. Sequential reachable choice owners combine; a choice with `endRound:true` skips only later authored owners in the same round.
- Never mutate the live reader session, saved progress, localStorage, authored `phoneData`, or the visible reader DOM while planning or rendering alternate branches.
- Default mode is `current`; existing single-route filenames and pagination remain backward compatible.
- All-branches mode may render at most 64 chat branch jobs in one export. Probe overflow before screenshots and fail with a clear Chinese message; never silently truncate.
- Every route is a separate screenshot job, so its `scrollHeight`, breakpoints, page count, and `-01/-02` suffixes are calculated independently.
- Branch filename identifiers must begin with a deterministic `分支NN` prefix before human-readable option text so truncation cannot erase uniqueness. Reader placeholder values must still be masked before filename creation.
- Preserve all pre-existing unrelated worktree changes and untracked files. Do not commit, push, deploy, or delete user files in this task.

---

## Task 1: Add a pure reachable-chat-branch enumerator

**Files:**

- Modify: `js/phone-story-state.js`
- Modify: `tests/phone-story-state.test.mjs`

- [x] Add failing tests for no-choice, simple, conditional, sequential, `endRound`, scoped-key, overflow, and immutability behavior.

Use a fixture with two rounds and assert the exact path maps:

```js
const result = enumeratePhoneStoryChatChoiceBranches(phoneData, 0, new Map(), {
  maxBranches:64,
  maxStates:10_000,
})

assert.equal(result.truncated, false)
assert.deepEqual(
  result.branches.map(branch => branch.path.map(step => step.choiceId)),
  [["choice-a", "choice-next"], ["choice-b"]],
)
```

The `choice-b` fixture sets `endRound:true`; the next owner is in that same round, while another test places the next owner in a later round and confirms it remains reachable.

- [x] Run the red test and record that the new export is missing:

```powershell
node --test tests/phone-story-state.test.mjs
```

Expected: the new tests fail because `enumeratePhoneStoryChatChoiceBranches` is not exported.

- [x] Implement and export this contract from `js/phone-story-state.js`:

```js
export function enumeratePhoneStoryChatChoiceBranches(
  phoneData,
  chatIndex,
  currentSelections,
  options = {},
) {
  return {
    branches:[{
      key:"stable-machine-key",
      selections:new Map(),
      path:[{
        selectionKey:"owner-or-scoped-key",
        ownerMessageId:"owner-id",
        ownerOrder:0,
        choiceId:"choice-id",
        choiceIndex:0,
        label:"选项文本",
      }],
    }],
    truncated:false,
    reason:null,
    statesVisited:1,
  }
}
```

Implementation rules:

1. Normalize `chat.messages` exactly like `openReaderChat`: use it as the only round when `rounds` is empty; otherwise append it to the last authored round.
2. Build owner descriptors in round/message order. Compute each selection key through existing `choiceSelectionKeyForEntry`/scope logic; do not hand-build scoped keys.
3. Copy and normalize the supplied current map, then remove every valid owner key belonging to the target chat. This preserved outside-chat snapshot is the baseline for every candidate route.
4. Each DFS state rebuilds `baseline + target selections`, calls `prunePhoneStoryChoiceSelections`, and discards a child if the newly selected owner/choice does not survive pruning.
5. Find the first authored owner that is condition-valid, condition-visible, unselected, and not blocked by an earlier selected `endRound` choice in the same normalized round. Branch in authored choice order over unique valid choice IDs.
6. A state with no reachable unresolved owner is terminal. Canonicalize its target-chat path in authored owner order, then deduplicate by a stable key made from `[selectionKey, choiceId]` pairs.
7. Treat malformed/dangling conditions as hidden. Ignore unsupported/missing/duplicate choice IDs. Do not recursively discover choices inside `followUpMessages`.
8. Track canonical state signatures to prevent cycles. Default to `maxBranches:64` and `maxStates:10_000`; probe one extra terminal and return `truncated:true` with reason `branch-limit` or `state-limit`.
9. Never mutate `phoneData` or `currentSelections`.

- [x] Run the focused green tests:

```powershell
node --test tests/phone-story-state.test.mjs
```

Expected: all phone story-state tests pass.

## Task 2: Inject detached branch selections into static chat export jobs

**Files:**

- Modify: `reader/reader.js`
- Modify: `tests/reader-phone-content-export.test.mjs`
- Modify: `tests/reader-chat-choice-runtime.test.mjs`

- [x] Add failing source-contract and runtime tests covering:

  - `openReaderChat(..., { exportMode:true, exportChoiceSelections:branch.selections })`;
  - an export clone replaces only its `phoneChoiceSelections` and clears pending choice playback state;
  - chat condition visibility reads the detached export map, not `readerPhoneChoiceSession(work)`;
  - branch A materializes only A's reader reply/follow-ups, branch B only B's;
  - rendering either branch leaves the live selected choice and saved progress unchanged.

- [x] Run the red tests:

```powershell
node --test tests/reader-phone-content-export.test.mjs tests/reader-chat-choice-runtime.test.mjs
```

Expected: new alternate-selection injection assertions fail.

- [x] Import `enumeratePhoneStoryChatChoiceBranches` in `reader/reader.js`, add `PHONE_EXPORT_MAX_CHAT_BRANCHES = 64`, and extend visibility safely:

```js
function readerPhoneStoryItemVisible(work, item, phoneData, selections) {
  var storyData = phoneData || (work?.type === "phone" ? work.phoneData : null)
  if (!phoneStoryItemHasValidConditionReferences(storyData, item)) return false
  var selectedChoiceIds = selections === undefined
    ? readerPhoneStoryChoiceIds(work)
    : selectedPhoneStoryChoiceIds(selections)
  return phoneStoryItemIsVisible(item, selectedChoiceIds)
}
```

Every visibility call inside `openReaderChat` (including inline linked forum content and unsequenced continuation scanning) must pass `phoneChoiceSession.phoneChoiceSelections`. Existing non-export callers may omit the fourth argument.

- [x] In `openReaderChat`, after cloning the live export session, apply a fresh alternate snapshot only when supplied:

```js
if (exportMode && runtimeOptions?.exportChoiceSelections instanceof Map) {
  phoneChoiceSession.phoneChoiceSelections = new Map(runtimeOptions.exportChoiceSelections)
  phoneChoiceSession.phonePendingChoicePlaybacks = new Map()
}
```

Do not call `reconcileReaderPhoneStorySelections`, `saveCurrentReaderProgress`, or mutate the live session for this path.

- [x] Extend `readerPhoneExportJobs(pd, exportFrame, options)`:

  - `branchMode:"current"` creates today's one chat job and does not supply an override;
  - `branchMode:"all"` calls the enumerator once per chat with the live selection map, creates one job per returned terminal branch, and supplies the detached selection map;
  - chats with no reachable choice still create exactly one ordinary, unlabelled job;
  - total alternate chat jobs over 64, `truncated:true`, or a state-limit result throws before any screenshot with: `可导出的消息选项分支超过 64 条，请减少选项后重试，或改用“当前阅读分支”。`;
  - dynamic, forum, memo, gallery, browser, shopping, and contacts jobs remain singletons.

- [x] Run the focused green tests:

```powershell
node --test tests/reader-phone-content-export.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/phone-story-state.test.mjs
```

Expected: all targeted reader/export state tests pass.

## Task 3: Add export-mode UI, deterministic branch labels, and archive naming

**Files:**

- Modify: `reader/phone-content-export.js`
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/phone-content-export.test.mjs`
- Modify: `tests/reader-phone-content-export.test.mjs`

- [x] Add failing tests for filename and UI contracts:

```js
assert.equal(
  phoneExportBranchLabel([
    { ownerOrder:0, choiceIndex:1, label:"去码头" },
    { ownerOrder:1, choiceIndex:0, label:"等雨停" },
  ], 0, 3),
  "分支01-选项1.2-去码头→选项2.1-等雨停",
)
assert.equal(
  phoneExportArchiveName("夏夜/回声", "all"),
  "夏夜-回声-小手机全部分支图片.zip",
)
```

Also render two panels with different branch base names and heights through `capturePhonePanelPages`; assert branch A gets its own `-01/-02/-03` sequence and branch B starts again at `-01/-02`.

- [x] Run the red tests:

```powershell
node --test tests/phone-content-export.test.mjs tests/reader-phone-content-export.test.mjs
```

Expected: branch helper, archive mode, and radio-group assertions fail.

- [x] Export `phoneExportBranchLabel(path, zeroBasedIndex, total)` from `reader/phone-content-export.js`:

  - use a two-digit minimum deterministic `分支NN` prefix;
  - append authored owner/choice ordinals and a concise plain-text label;
  - cap each readable label by Unicode code points before the existing portable segment sanitizer;
  - an empty path returns an empty string.

Change `phoneExportArchiveName(workTitle, branchMode = "current")` so only `all` adds `全部分支`; preserve the existing current-mode filename exactly.

- [x] In all-branches jobs, prefix `itemLabel` with the branch label, then the chat label. This keeps `分支NN` inside the existing 80-character item segment and before the pagination suffix. Continue passing the final descriptor through `maskPhoneExportText` and `phoneExportBaseName`.

- [x] Add this accessible fieldset to `openReaderPhoneExportDialog` before the progress box:

```html
<fieldset class="rd-phone-export-modes">
  <legend>聊天回复分支</legend>
  <label>
    <input type="radio" name="readerPhoneExportBranchMode" value="current" checked>
    <span><strong>当前阅读分支</strong><small>按你现在已经选择的聊天回复导出，速度更快。</small></span>
  </label>
  <label>
    <input type="radio" name="readerPhoneExportBranchMode" value="all">
    <span><strong>所有选项分支</strong><small>每个聊天的可达回复路线分别成图、各自分页；最多 64 条。</small></span>
  </label>
</fieldset>
```

The selected value is read once when export starts and passed as `branchMode`. Disable both radios while busy, restore them in `finally`, and update the primary button text when the selection changes (`导出当前阅读分支` / `导出所有选项分支`). The dialog copy must state that non-chat modules still export once.

- [x] Style the fieldset as two keyboard-accessible compact cards in the existing `.rd-phone-export-*` block. Include checked state, `:focus-visible`, disabled state, and reduced-motion compatibility without changing the modal's width or mobile fit.

- [x] Run the focused green tests:

```powershell
node --test tests/phone-content-export.test.mjs tests/reader-phone-content-export.test.mjs tests/phone-story-state.test.mjs tests/reader-chat-choice-runtime.test.mjs
```

Expected: all targeted tests pass.

## Task 4: Verify the complete export workflow and perform independent review

**Files:**

- Verify all files modified above
- Update: `.superpowers/sdd/progress.md`

- [x] Run whitespace and focused verification:

```powershell
git diff --check
node --test tests/phone-story-state.test.mjs tests/phone-content-export.test.mjs tests/reader-phone-content-export.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-phone-story-events.test.mjs
```

Expected: exit 0, no whitespace errors, all focused tests pass.

- [x] Run the full project gate:

```powershell
npm run verify
```

Expected: the complete node:test suite, TypeScript build, and production Vite builds pass.

- [x] Real-browser acceptance with a work containing one chat with two first-level options, a conditional second owner, one `endRound` route, and a long transfer/payment message:

  1. Current mode exports exactly one version of the chat and keeps the old filename form.
  2. All mode exports every expected terminal route, each filename starts with its stable `分支NN` label, and the ZIP name says `全部分支`.
  3. Multi-page numbering restarts per route and no message/payment card crosses or overlaps a page boundary.
  4. Selecting a route before export does not restrict all mode to that route.
  5. Reader selections, scroll/navigation state, and localStorage are unchanged after export and after cancel.
  6. A 65th branch fails before rasterization with the exact safety message and saves no partial ZIP.

- [x] Request an independent final code review covering route completeness, selection isolation, overflow behavior, filename collisions/truncation, pagination independence, accessibility, and accidental scope expansion. Resolve all Critical/Important findings and rerun the relevant tests.

- [x] Append concise red/green/full-verification/browser/review evidence to `.superpowers/sdd/progress.md`. Do not commit, push, or deploy.
