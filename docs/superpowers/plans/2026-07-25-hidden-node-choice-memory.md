# Hidden Nodes and Choice Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authors insert condition-only paragraph nodes whose visibility depends on stable choices made earlier in the current reading route.

**Architecture:** Choices keep their existing immutable `choice.id`; the reader stores the latest selected choice per source node. A conditional node owns an AND-of-OR expression: every group must match, while any choice inside a group may satisfy that group. The article path runtime skips unmet conditional nodes and inserts met conditional nodes at their structure-tree position, including immediately before a branch target.

**Tech Stack:** Vanilla JavaScript ES modules, local JSON work schema, DOM-based author and reader UIs, Node test runner, JSDOM, Vite.

## Global Constraints

- A chapter is one reader page; nodes are ordered paragraphs inside that page.
- Node titles remain author-only and never render in reader prose.
- Choice IDs are generated once and are never editable in the UI.
- Ordinary-interaction choices split authored copy into `text` (the button label) and
  `selectedText` (the prose shown after selection). Existing choices without
  `selectedText` fall back to `text`, so old works keep their current appearance.
- Editing either ordinary-interaction text field never changes the stable choice ID.
- A conditional node is supplemental prose: it cannot be the story start, a choice target, an interactive-scene node, or own an option group in version 1.
- Condition groups use AND between groups and OR within one group.
- Version 1 memory means the latest choice on the active reading route; repeat counts and “ever selected across restarts” are excluded.
- Reader memory is isolated by work and reading session and is not written into the exported work.
- The work schema advances from version 2 to version 3 so an older reader rejects, rather than accidentally reveals, conditional prose.
- Existing version 0–2 works normalize with no conditional nodes and remain readable.

---

## File Structure

- Create `js/article-condition-model.js`: normalize, validate, describe, search, and evaluate conditional-node expressions.
- Create `js/article-choice-memory.js`: immutable latest-selection map and route-pruning helpers.
- Modify `js/work-schema.js`: schema version 3 and conditional-node normalization.
- Modify `js/data.js`: create a conditional paragraph node in a chosen chapter.
- Modify `js/article-chapter-runtime.js`: skip unmet conditionals and insert eligible conditional preludes around branch targets.
- Modify `reader/reader.js`: own route memory, record both interaction and branch choices, and pass memory into path transitions.
- Modify `js/pages/editor.js`: conditional-node creation, badges, condition editor, searchable choice picker, and invariant guards.
- Modify `css/styles.css`: condition editor and outline badge styling.
- Add focused model, runtime, editor integration, reader integration, and schema tests under `tests/`.

---

### Task 1: Conditional Node Data Contract and Schema Version

**Files:**
- Create: `js/article-condition-model.js`
- Modify: `js/article-choice-model.js`
- Modify: `js/work-schema.js`
- Modify: `js/data.js`
- Test: `tests/article-condition-model.test.mjs`
- Test: `tests/article-choice-model.test.mjs`
- Test: `tests/work-schema.test.mjs`
- Test: `tests/article-save-adapter.test.mjs`

**Interfaces:**
- Produces: `normalizeArticleDisplayCondition(value) -> { all: Array<{ anyChoiceIds: string[] }> }`
- Produces: `articleNodeIsConditional(node) -> boolean`
- Produces: `createConditionalArticleNode(workId, chapterId, afterId?) -> node | null`
- Ordinary-interaction choice shape:

```js
{
  id: "choice-agree",
  mode: "interaction",
  text: "同意牵手",
  selectedText: "你把手放进了对方掌心。",
  targetId: "",
}
```
- Node shape:

```js
{
  id: "node-memory-line",
  kind: "conditional",
  title: "隐藏节点",
  content: "<p>角色B想起了那次拒绝。</p>",
  chapterId: "chapter-3",
  choices: [],
  displayCondition: {
    all: [
      { anyChoiceIds: ["choice-d"] },
      { anyChoiceIds: ["choice-b"] },
    ],
  },
}
```

- [ ] **Step 1: Write failing model tests**

```js
test("normalizes an AND-of-OR condition without duplicate or empty ids", () => {
  assert.deepEqual(normalizeArticleDisplayCondition({
    all: [
      { anyChoiceIds: ["choice-a", "choice-a", ""] },
      { anyChoiceIds: ["choice-b"] },
    ],
  }), {
    all: [
      { anyChoiceIds: ["choice-a"] },
      { anyChoiceIds: ["choice-b"] },
    ],
  })
})
```

- [ ] **Step 2: Run the model test and verify it fails**

Run: `node --test tests/article-condition-model.test.mjs`

Expected: FAIL because `js/article-condition-model.js` does not exist.

- [ ] **Step 3: Implement normalization and node classification**

```js
export function normalizeArticleDisplayCondition(value) {
  const groups = Array.isArray(value?.all) ? value.all : []
  return {
    all: groups.map(group => ({
      anyChoiceIds: [...new Set(
        (Array.isArray(group?.anyChoiceIds) ? group.anyChoiceIds : [])
          .map(id => String(id || "").trim())
          .filter(Boolean),
      )],
    })).filter(group => group.anyChoiceIds.length > 0),
  }
}

export function articleNodeIsConditional(node) {
  return node?.kind === "conditional"
}
```

- [ ] **Step 4: Add schema version and invariant tests**

Test that schema version 3:

- preserves `text` and `selectedText` separately for ordinary interactions;
- supplies `selectedText: text` when importing an older ordinary interaction;
- preserves valid conditions;
- removes duplicate and dangling empty IDs but preserves unknown node metadata;
- coerces conditional-node `choices` to `[]`;
- rejects a conditional node used as `startNode`;
- rejects a branch choice whose `targetId` is conditional;
- migrates version 2 works unchanged except for `schemaVersion: 3`.

- [ ] **Step 5: Implement schema version 3 normalization**

Set `CURRENT_WORK_SCHEMA_VERSION = 3`. Normalize `displayCondition` only when `kind === "conditional"`. Return a stable import failure with paths such as `$.nodes[2].displayCondition` when a conditional node violates start/target invariants.

Normalize ordinary interactions so `text` remains the pre-selection label and
`selectedText` is the post-selection prose. Keep branch choices compatible without
requiring `selectedText`. Reconciliation must preserve an existing choice ID when
either text field changes.

- [ ] **Step 6: Add and implement conditional-node creation**

```js
export function createConditionalArticleNode(workId, chapterId, afterId) {
  return addPreparedArticleNode(workId, {
    afterId,
    chapterId,
    node: {
      id: uid(),
      title: "隐藏节点",
      content: "",
      choices: [],
      scene: "",
      kind: "conditional",
      displayCondition: { all: [] },
    },
  })
}
```

Reuse the same verified local-write path as ordinary node creation; do not create a second storage format.

- [ ] **Step 7: Run focused schema and save tests**

Run: `node --test tests/article-condition-model.test.mjs tests/article-choice-model.test.mjs tests/work-schema.test.mjs tests/article-save-adapter.test.mjs`

Expected: PASS.

---

### Task 2: Choice Catalog, Search, and Stable References

**Files:**
- Modify: `js/article-condition-model.js`
- Test: `tests/article-condition-model.test.mjs`

**Interfaces:**
- Produces: `buildArticleChoiceCatalog(work, { query, excludeNodeId? })`
- Catalog item:

```js
{
  choiceId: "choice-b",
  choiceText: "拒绝牵手",
  choiceMode: "branch",
  sourceNodeId: "date-question",
  sourceNodeTitle: "是否牵手",
  chapterId: "chapter-date",
  chapterName: "第一次约会",
  searchText: "第一次约会 是否牵手 拒绝牵手 choice-b",
}
```

- [ ] **Step 1: Write failing catalog tests**

Cover search by choice text, source node title, chapter name, and exact stable ID. Verify duplicate choice IDs are marked ambiguous and cannot be selected.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/article-condition-model.test.mjs`

Expected: FAIL because `buildArticleChoiceCatalog` is absent.

- [ ] **Step 3: Implement catalog construction**

Walk chapters and nodes in author structure order. Preserve both branch and ordinary-interaction choices. Include both `text` and `selectedText` in local search while keeping `text` as the primary author-facing label. Build one flattened searchable list and return explicit `{ disabled, reason }` state for ambiguous or dangling IDs.

- [ ] **Step 4: Run and verify pass**

Run: `node --test tests/article-condition-model.test.mjs`

Expected: PASS.

---

### Task 3: Route-Scoped Choice Memory and Condition Evaluation

**Files:**
- Create: `js/article-choice-memory.js`
- Modify: `js/article-condition-model.js`
- Test: `tests/article-choice-memory.test.mjs`
- Test: `tests/article-condition-model.test.mjs`

**Interfaces:**
- Produces: `recordArticleChoice(memory, sourceNodeId, choiceId) -> newMemory`
- Produces: `pruneArticleChoiceMemory(memory, retainedNodeIds) -> newMemory`
- Produces: `selectedArticleChoiceIds(memory) -> Set<string>`
- Produces: `articleDisplayConditionMatches(condition, selectedIds) -> boolean`

- [ ] **Step 1: Write failing memory tests**

```js
test("reselecting at one source replaces its old choice without mutating memory", () => {
  const first = recordArticleChoice({}, "node-1", "choice-a")
  const second = recordArticleChoice(first, "node-1", "choice-b")
  assert.deepEqual(first, { "node-1": "choice-a" })
  assert.deepEqual(second, { "node-1": "choice-b" })
})
```

Also verify pruning removes choices from abandoned downstream nodes while retaining earlier chapters.

- [ ] **Step 2: Write failing evaluator tests**

Verify:

- `{all:[{anyChoiceIds:["a","c"]}]}` matches either `a` or `c`;
- adding `{anyChoiceIds:["b"]}` requires `(a OR c) AND b`;
- an empty condition never displays a conditional node;
- dangling choice IDs simply do not match.

- [ ] **Step 3: Run and verify failures**

Run: `node --test tests/article-choice-memory.test.mjs tests/article-condition-model.test.mjs`

Expected: FAIL because memory and evaluation functions are absent.

- [ ] **Step 4: Implement immutable memory and evaluator**

```js
export function articleDisplayConditionMatches(condition, selectedIds) {
  const normalized = normalizeArticleDisplayCondition(condition)
  if (normalized.all.length === 0) return false
  return normalized.all.every(group => (
    group.anyChoiceIds.some(choiceId => selectedIds.has(choiceId))
  ))
}
```

- [ ] **Step 5: Run and verify pass**

Run: `node --test tests/article-choice-memory.test.mjs tests/article-condition-model.test.mjs`

Expected: PASS.

---

### Task 4: Conditional-Aware Article Path Runtime

**Files:**
- Modify: `js/article-chapter-runtime.js`
- Test: `tests/article-chapter-runtime.test.mjs`

**Interfaces:**
- Extend `expandArticleChapterPath(nodes, path, options?)`
- Extend `appendArticleChoice(nodes, path, sourcePathIndex, targetId, options?)`
- Extend `continueArticleInteraction(nodes, path, sourcePathIndex, options?)`
- Extend `nextArticleChapterPath(nodes, chapters, path, options?)`
- Options:

```js
{
  isNodeVisible(node) {
    return node.kind !== "conditional"
      || articleDisplayConditionMatches(node.displayCondition, selectedIds)
  },
}
```

- [ ] **Step 1: Write failing sequential-runtime tests**

Cover a chapter ordered as:

```js
[
  { id: "17", choices: [{ id: "d", targetId: "18" }] },
  { id: "20", kind: "conditional", displayCondition: conditionDAndB },
  { id: "18", choices: [] },
]
```

Selecting `d` with earlier `b` must produce `["17", "20", "18"]`; without `b` it must produce `["17", "18"]`.

- [ ] **Step 2: Add placement tests**

Move node `20` after `18` and verify the visible path becomes `["17", "18", "20"]`. Add multiple consecutive conditional nodes before a target and verify structure order is stable.

- [ ] **Step 3: Add boundary tests**

Verify:

- unmet conditional nodes never become flow barriers;
- empty chapters remain skipped by NEXT;
- a visible conditional node before the next chapter’s first ordinary node renders first;
- conditional nodes are not returned as selectable branch targets.

- [ ] **Step 4: Run and verify failures**

Run: `node --test tests/article-chapter-runtime.test.mjs`

Expected: FAIL because runtime transitions ignore conditional visibility and target preludes.

- [ ] **Step 5: Implement conditional scanning**

Add private helpers that:

1. find the target’s ordered chapter index;
2. collect contiguous conditional nodes immediately before the target;
3. include only nodes for which `isNodeVisible` returns true;
4. append the target;
5. scan forward, skipping unmet conditionals and stopping at the next ordinary choice barrier.

Do not infer visibility from node titles or editable text.

- [ ] **Step 6: Run and verify pass**

Run: `node --test tests/article-chapter-runtime.test.mjs`

Expected: PASS.

---

### Task 5: Reader Selection Recording and Hidden-Node Rendering

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-hidden-node-memory.test.mjs`
- Test: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Reader state: `_articleChoiceMemory = { [sourceNodeId]: choiceId }`
- Reader helper: `articleRuntimeOptions() -> { isNodeVisible(node) }`

- [ ] **Step 1: Write a failing end-to-end reader test**

Build a work where chapter 1 records choice `b`, chapter 2 records `d`, and chapter 2 contains conditional node `20` requiring both. Verify `20` is absent after only `b` and appears in structural order after `d`.

Also verify an ordinary-interaction button displays `text` before selection, then
renders `selectedText` as the selected response without navigating. For legacy
choices without `selectedText`, verify the selected response falls back to `text`.

- [ ] **Step 2: Add re-selection and backtracking tests**

Go back, replace `b` with another choice, replay chapter 2, and verify node `20` disappears. Verify unrelated earlier choices remain recorded.

- [ ] **Step 3: Run and verify failures**

Run: `node --test tests/reader-hidden-node-memory.test.mjs tests/reader-critical-flow.test.mjs`

Expected: FAIL because reader transitions do not own universal choice memory.

- [ ] **Step 4: Record every article choice**

Before branch or interaction transition:

```js
_articleChoiceMemory = recordArticleChoice(
  _articleChoiceMemory,
  btn.dataset.choiceNodeId || "",
  btn.dataset.choiceId || "",
)
```

After path truncation, prune memory for source nodes no longer retained on the active route.

For ordinary interactions, keep the option button label as `text` and render the
chosen response prose from `selectedText || text`. Do not replace or mutate the
authored choice record in reader state.

- [ ] **Step 5: Pass visibility into every transition**

Use the same `articleRuntimeOptions()` for initial render, branch choice, ordinary interaction, NEXT, and interactive-scene continuation. Reset memory when starting a different work or returning home.

- [ ] **Step 6: Run and verify pass**

Run: `node --test tests/reader-hidden-node-memory.test.mjs tests/reader-critical-flow.test.mjs`

Expected: PASS.

---

### Task 6: Author Hidden-Node Creation and Condition Editor

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Test: `tests/article-hidden-node-editor.test.mjs`
- Test: `tests/article-outline-accessibility.test.mjs`
- Test: `tests/article-target-picker-integration.test.mjs`

**Interfaces:**
- Chapter action: `data-a="chapter-add-conditional"`
- Node action: `data-a="edit-display-condition"`
- Modal rows serialize to `displayCondition.all`.

- [ ] **Step 1: Write failing author UI tests**

Verify each chapter action group includes “添加隐藏节点”, the created outline item has a “隐藏” badge, and the editor toolbar does not offer option editing while that node is active.

- [ ] **Step 2: Add failing condition-editor tests**

Open a conditional node’s condition editor and verify:

- copy says “以下条件全部满足时显示”;
- each group has a searchable choice picker;
- selected choices inside one group read as “任一项（或）”;
- “添加附加条件（且）” creates a new group;
- search matches choice text, node title, chapter name, and stable ID;
- saved IDs remain unchanged if source choice text is later edited;
- deleting a referenced choice renders a visible “条件已失效” warning instead of silently substituting another choice.

Add ordinary-interaction editor coverage:

- each option row has distinct “选项文本” and “选择后内容” inputs;
- editing either field preserves the existing stable choice ID;
- switching to branch mode keeps the option label and target workflow without
  requiring post-selection prose;
- an imported legacy interaction opens with both fields populated from its old
  `text` value.

- [ ] **Step 3: Run and verify failures**

Run: `node --test tests/article-hidden-node-editor.test.mjs tests/article-outline-accessibility.test.mjs`

Expected: FAIL because hidden-node controls do not exist.

- [ ] **Step 4: Implement creation and badges**

Add `＋隐` beside existing chapter “＋” and interactive “◎” actions with full accessible label `在本章添加隐藏节点`. Show a compact `隐藏` badge in the structure tree and a condition summary such as `（拒绝牵手）且（选择留下）`.

- [ ] **Step 5: Implement the searchable condition editor**

Use an inline modal consistent with the existing choice editor. Search locally with `buildArticleChoiceCatalog`; never expose raw IDs as the primary label, but include a copyable short ID in secondary text for disambiguation.

Update the existing option-group editor at the same time: ordinary-interaction rows
show separate `text` and `selectedText` controls, while branch rows keep `text` plus
target selection. Saving either form must reconcile by immutable choice ID.

- [ ] **Step 6: Enforce author invariants**

Disable “设为起点” and branch-target selection for conditional nodes. Hide option-group editing and interactive-page conversion while a conditional node is active. If an imported invalid reference exists, show it as unresolved and require author action before save.

- [ ] **Step 7: Run and verify pass**

Run: `node --test tests/article-hidden-node-editor.test.mjs tests/article-outline-accessibility.test.mjs tests/article-target-picker-integration.test.mjs`

Expected: PASS.

---

### Task 7: Import, Export, and Full Regression Verification

**Files:**
- Modify: `tests/reader-import-resilience.test.mjs`
- Modify: `tests/acceptance-sample-works.test.mjs`
- Modify: `docs/superpowers/plans/2026-07-25-hidden-node-choice-memory.md` only if verification exposes a contract correction

**Interfaces:**
- Consumes all version 3 work and runtime interfaces above.
- Produces a release-ready conditional-node feature without personal reader data in exported work JSON.

- [ ] **Step 1: Add transport tests**

Verify export/import preserves:

- conditional node `kind`;
- stable referenced choice IDs;
- ordinary-interaction `text` and `selectedText` as separate authored fields;
- legacy ordinary interactions normalized with `selectedText` falling back to `text`;
- AND-of-OR groups;
- unknown future metadata;
- no `_articleChoiceMemory`, reader profile, reader avatar, or reader ID.

- [ ] **Step 2: Add old-reader safety test**

Verify schema 3 is rejected by a schema-2 compatibility fixture rather than rendered as unconditional prose.

- [ ] **Step 3: Run the full relevant suite**

Run:

```powershell
node --test `
  tests/article-condition-model.test.mjs `
  tests/article-choice-model.test.mjs `
  tests/article-choice-memory.test.mjs `
  tests/article-chapter-runtime.test.mjs `
  tests/article-hidden-node-editor.test.mjs `
  tests/article-outline-accessibility.test.mjs `
  tests/article-target-picker-integration.test.mjs `
  tests/reader-hidden-node-memory.test.mjs `
  tests/reader-critical-flow.test.mjs `
  tests/reader-import-resilience.test.mjs `
  tests/work-schema.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 4: Run the project verification**

Run: `npm run verify`

Expected: full Node suite and `build:verify` PASS.

- [ ] **Step 5: Manual 8765 acceptance**

Create choices `a/b/c`, then:

1. create a conditional paragraph before its target and verify it appears before the target;
2. move it after the target and verify it appears after the target;
3. configure `(a OR c) AND b` and exercise both matching and non-matching routes;
4. rename all referenced choice text and verify conditions remain linked;
5. delete one referenced choice and verify the author warning and reader non-match;
6. export JSON and import it into the reader, confirming identical behavior and absence of reader personal data.
7. create an ordinary interaction whose option text and selected content differ,
   then confirm author preview and imported reader both show the label before the
   click and only the selected content after the click.

Expected: author preview and imported reader copy behave identically.

---

## Self-Review

- Spec coverage: stable immutable choice IDs, split ordinary-interaction label/result
  text, searchable condition references, AND plus OR logic, hidden-node structural
  placement, route memory, old-work migration, export privacy, author UI,
  preview/import parity, and NEXT integration each have a task.
- Explicitly excluded from version 1: repeat counts, cross-reading historical memory, numeric comparison conditions, free-form scripting, conditional interactive-scene nodes, and conditional branch targets.
- Placeholder scan: no implementation placeholder or unspecified error-handling step remains.
- Type consistency: every runtime consumes `displayCondition.all[].anyChoiceIds`; every reader selection uses `{[sourceNodeId]: choiceId}`; all search results reference immutable `choiceId`.
