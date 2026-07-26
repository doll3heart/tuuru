# Inline Ordinary Interaction Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow every article node to contain multiple independently remembered ordinary-interaction groups at authored positions inside the body while keeping all plot-routing choices in one fixed group at the node end.

**Architecture:** Add `interactionGroups` as a first-class node collection. Each group and each option keeps a stable ID; a sanitized atomic marker in `node.content` determines the group's body position, while `node.choices` becomes branch-only for new schema data. Preserve schema-v3 behavior through a schema-v4 migration that converts legacy interaction choices into one tail group without losing IDs, text, selected copy, unknown choice metadata, or legacy advance behavior. Route memory and ordinary-interaction memory remain separate and their selected choice IDs are unioned for hidden-node conditions.

**Tech Stack:** Browser ES modules, DOM/`contenteditable`, localStorage-backed work schema, Node test runner, JSDOM, CSS.

## Global Constraints

- A node may contain zero or more ordinary-interaction groups.
- Ordinary-interaction groups may be placed between body paragraphs and moved without changing group or option IDs.
- Plot-routing choices always render after the body and never inside an ordinary-interaction group.
- Selecting an inline ordinary option updates only its own group, displays multiline selected copy with reader typography, and does not navigate.
- Hidden-node conditions may reference stable IDs from either ordinary or branch options.
- Legacy article data must remain importable and must not lose authored prose, choices, targets, selected copy, or unknown extension fields.
- Conditional and interactive-scene nodes cannot own ordinary-interaction groups.
- The editor must remain usable with keyboard, coarse pointer, phone, tablet, and desktop layouts.
- Existing gray-pink Tuuru tokens and compact product-control vocabulary remain authoritative; no decorative redesign.

---

### Task 1: Stable interaction-group model and marker contract

**Files:**
- Create: `js/article-interaction-group-model.js`
- Create: `tests/article-interaction-group-model.test.mjs`

**Interfaces:**
- Produces: `ARTICLE_INTERACTION_MARKER_CLASS`
- Produces: `articleInteractionMarkerHTML(groupId)`
- Produces: `articleInteractionMarkerIds(content)`
- Produces: `normalizeArticleInteractionGroups(groups, options)`
- Produces: `migrateLegacyArticleInteractions(node, idFactory)`
- Produces: `reconcileArticleInteractionGroup(existingGroup, draft, idFactory)`
- Produces: `moveArticleInteractionGroup(groups, groupId, toIndex)`

- [ ] **Step 1: Write failing model tests**

```js
test("marker parsing returns exact authored group ids in body order", () => {
  const content = `<p>A</p>${articleInteractionMarkerHTML("group-a")}<p>B</p>${articleInteractionMarkerHTML("group-b")}`
  assert.deepEqual(articleInteractionMarkerIds(content), ["group-a", "group-b"])
})

test("legacy interaction choices migrate without changing stable choice ids", () => {
  const node = {
    id:"node-a",
    content:"<p>正文</p>",
    choices:[
      {id:"ordinary-a", mode:"interaction", text:"点头", selectedText:"你点了点头。", targetId:"", extra:{keep:true}},
      {id:"branch-a", text:"离开", targetId:"node-b"},
    ],
  }
  const migrated = migrateLegacyArticleInteractions(node, () => "group-a")
  assert.deepEqual(migrated.node.choices, [{id:"branch-a", text:"离开", targetId:"node-b"}])
  assert.equal(migrated.node.interactionGroups[0].choices[0].id, "ordinary-a")
  assert.deepEqual(migrated.node.interactionGroups[0].choices[0].extra, {keep:true})
  assert.match(migrated.node.content, /data-article-interaction-group="group-a"/)
})
```

- [ ] **Step 2: Run the model test and verify it fails**

Run: `node --test tests/article-interaction-group-model.test.mjs`

Expected: FAIL because `js/article-interaction-group-model.js` does not exist.

- [ ] **Step 3: Implement strict, non-mutating group helpers**

Use this public record shape:

```js
{
  id: "stable-group-id",
  choices: [{
    id: "stable-choice-id",
    text: "按钮文字",
    selectedText: "选择后内容"
  }],
  legacyAdvanceOnSelect: false
}
```

Markers must be atomic authoring elements:

```html
<div class="article-interaction-anchor"
     data-article-interaction-group="stable-group-id"
     contenteditable="false"></div>
```

Reject duplicate/malformed group and choice IDs instead of silently merging them. Preserve unknown own data properties on valid group and choice records.

- [ ] **Step 4: Run the model test and verify it passes**

Run: `node --test tests/article-interaction-group-model.test.mjs`

Expected: PASS.

### Task 2: Schema-v4 migration and sanitizer support

**Files:**
- Modify: `js/work-schema.js`
- Modify: `js/sanitize.js`
- Modify: `js/data.js`
- Modify: `tests/work-schema.test.mjs`
- Modify: `tests/interactive-scene-sanitize.test.mjs`

**Interfaces:**
- Consumes: Task 1 marker and migration helpers.
- Produces: normalized `node.interactionGroups` on schema-v4 articles.

- [ ] **Step 1: Add failing schema and sanitizer tests**

```js
test("version 3 interaction choices become one anchored version 4 group", () => {
  const result = validateWorkForImport(version3ArticleWithInteractionChoices)
  assert.equal(result.ok, true)
  assert.equal(result.work.schemaVersion, 4)
  assert.deepEqual(result.work.nodes[0].choices.map(choice => choice.id), ["branch-a"])
  assert.deepEqual(result.work.nodes[0].interactionGroups[0].choices.map(choice => choice.id), ["ordinary-a"])
})

test("ordinary interaction anchors keep only an exact safe group id", () => {
  assert.match(sanitizeHTML('<div class="article-interaction-anchor" data-article-interaction-group="group-a"></div>'), /group-a/)
  assert.doesNotMatch(sanitizeHTML('<div class="article-interaction-anchor" data-article-interaction-group=" bad "></div>'), /article-interaction-anchor/)
})
```

- [ ] **Step 2: Run schema and sanitizer tests and verify failure**

Run: `node --test tests/work-schema.test.mjs tests/interactive-scene-sanitize.test.mjs`

Expected: FAIL on schema version and stripped marker attributes.

- [ ] **Step 3: Increment the work schema and normalize groups**

Set `CURRENT_WORK_SCHEMA_VERSION` to `4`. During v3-to-v4 normalization:

- Partition `choice.mode === "interaction"` out of `node.choices`.
- Create one stable group for those options and append its marker after existing body content.
- Set `legacyAdvanceOnSelect:true` only when the legacy node had no branch choices.
- Set `legacyAdvanceOnSelect:false` for a mixed legacy node so an ordinary click cannot bypass its branch.
- Leave branch choice IDs and targets unchanged.
- Reject groups on conditional or interactive-scene nodes.
- Remove marker classes whose group ID is absent, malformed, or ambiguous.

New article nodes start with `interactionGroups:[]`.

- [ ] **Step 4: Run schema and sanitizer tests and verify pass**

Run: `node --test tests/work-schema.test.mjs tests/interactive-scene-sanitize.test.mjs`

Expected: PASS.

### Task 3: Independent group-selection memory

**Files:**
- Create: `js/article-interaction-memory.js`
- Modify: `reader/reader.js`
- Create: `tests/article-interaction-memory.test.mjs`
- Modify: `tests/article-choice-memory.test.mjs`

**Interfaces:**
- Produces: `recordArticleInteractionSelection(memory, groupId, nodeId, choiceId)`
- Produces: `pruneArticleInteractionSelections(memory, retainedNodeIds)`
- Produces: `selectedArticleInteractionChoiceIds(memory)`
- Consumes: existing `selectedArticleChoiceIds` for branch memory.

- [ ] **Step 1: Add failing memory tests**

```js
test("selections from two groups in one node coexist", () => {
  let memory = recordArticleInteractionSelection({}, "group-a", "node-a", "choice-a")
  memory = recordArticleInteractionSelection(memory, "group-b", "node-a", "choice-b")
  assert.deepEqual([...selectedArticleInteractionChoiceIds(memory)], ["choice-a", "choice-b"])
})

test("reselecting one group leaves the other group untouched", () => {
  const current = {
    "group-a":{nodeId:"node-a", choiceId:"choice-a"},
    "group-b":{nodeId:"node-a", choiceId:"choice-b"},
  }
  const next = recordArticleInteractionSelection(current, "group-a", "node-a", "choice-c")
  assert.equal(next["group-a"].choiceId, "choice-c")
  assert.equal(next["group-b"].choiceId, "choice-b")
})
```

- [ ] **Step 2: Run memory tests and verify failure**

Run: `node --test tests/article-interaction-memory.test.mjs tests/article-choice-memory.test.mjs`

Expected: FAIL because the interaction-memory module is missing.

- [ ] **Step 3: Implement exact-ID memory and reader union**

Store ordinary selections as:

```js
{
  "group-id": {
    nodeId: "source-node-id",
    choiceId: "selected-choice-id"
  }
}
```

Keep `_articleChoiceMemory` for branch selections only. Build hidden-node visibility with:

```js
new Set([
  ...selectedArticleChoiceIds(_articleChoiceMemory),
  ...selectedArticleInteractionChoiceIds(_articleInteractionSelections),
])
```

Prune ordinary selections by their recorded source node whenever route history is truncated.

- [ ] **Step 4: Run memory tests and verify pass**

Run: `node --test tests/article-interaction-memory.test.mjs tests/article-choice-memory.test.mjs`

Expected: PASS.

### Task 4: Author editor inline group cards and placement

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`
- Create: `tests/article-inline-interaction-editor.test.mjs`
- Modify: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `tests/article-target-picker-integration.test.mjs`

**Interfaces:**
- Consumes: Task 1 group reconciliation and marker helpers.
- Produces: `data-a="add-interaction-group"`, `data-a="edit-interaction-group"`, and `data-a="move-interaction-group"` author actions.

- [ ] **Step 1: Add failing authoring tests**

Test these exact behaviors:

- “普通互动” inserts a new anchored group at the current editor range.
- The inserted card is `contenteditable="false"` and exposes Edit, Move, and Delete controls.
- A second group may be inserted in the same node.
- Moving a group removes its old marker and inserts one marker at the new range without changing IDs.
- Losing a marker does not delete group data; an “未放置的普通互动” recovery area appears.
- The branch editor contains branch choices only and no group-wide type selector.
- Adding or saving a branch never converts or removes ordinary groups.
- Phone layout keeps 44px primary actions and reflows copy fields without horizontal overflow.

- [ ] **Step 2: Run the authoring tests and verify failure**

Run: `node --test tests/article-inline-interaction-editor.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-target-picker-integration.test.mjs`

Expected: FAIL on missing inline actions and the old `#chMode` control.

- [ ] **Step 3: Implement the editor interaction**

Replace the current one-modal group type switch with:

- Toolbar action `普通互动` that inserts a group at the current caret.
- Existing `选项` action renamed `剧情分支` and restricted to `node.choices`.
- Atomic inline group cards showing group number, option count, and placement state.
- A focused group editor with option text, multiline selected copy, drag handle, keyboard Up/Down controls, add option, save, and delete group.
- “移动” enters a visible placement state; the next valid editor caret placement moves the marker. `Escape` cancels without a write.
- Missing-marker groups appear in a compact recovery strip above the branch card with “放到光标处” and “删除”.

Use existing tokens, 3–6px radii, 150–200ms state transitions, visible focus rings, and no nested decorative cards.

- [ ] **Step 4: Run authoring tests and verify pass**

Run: `node --test tests/article-inline-interaction-editor.test.mjs tests/article-editor-mobile-shell.test.mjs tests/article-target-picker-integration.test.mjs`

Expected: PASS.

### Task 5: Reader rendering and independent inline selection

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-inline-interaction-groups.test.mjs`
- Modify: `tests/reader-hidden-node-memory.test.mjs`
- Modify: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3 marker, group, and memory helpers.
- Produces: inline `.article-interaction-group` blocks and tail-only `.article-choices` branches.

- [ ] **Step 1: Add failing reader tests**

```js
test("two inline groups select independently before the tail branch", async () => {
  // Render group-a, prose, group-b, then branch choices.
  // Select choice-a and choice-b; both responses remain visible.
  // The article path remains at the source node until a branch is selected.
})

test("ordinary choices from separate groups jointly unlock a hidden node", async () => {
  // Hidden condition requires choice-a AND choice-b.
  // One selection is insufficient; both selections make the node visible.
})
```

Also verify multiline response paragraphs receive the same reader typography and first-line-indent rules as body paragraphs.

- [ ] **Step 2: Run reader tests and verify failure**

Run: `node --test tests/reader-inline-interaction-groups.test.mjs tests/reader-hidden-node-memory.test.mjs tests/reader-critical-flow.test.mjs`

Expected: FAIL because markers are not rendered as groups.

- [ ] **Step 3: Render inline groups before tail branches**

- Replace sanitized group markers with their matching group UI in body order.
- Render each group's selected response directly after its buttons.
- Use group ID—not node ID—for `aria-pressed` exclusivity.
- Do not call `continueArticleInteraction` for new inline groups.
- Keep plot choices after all body content.
- Preserve v3 legacy tail-group advance behavior only when `legacyAdvanceOnSelect:true`.
- Ignore orphan, duplicate, or malformed markers without exposing unsafe markup.

- [ ] **Step 4: Run reader tests and verify pass**

Run: `node --test tests/reader-inline-interaction-groups.test.mjs tests/reader-hidden-node-memory.test.mjs tests/reader-critical-flow.test.mjs`

Expected: PASS.

### Task 6: Condition catalog, preflight, and transport integrity

**Files:**
- Modify: `js/article-condition-model.js`
- Modify: `js/work-preflight.js`
- Modify: `tests/article-condition-model.test.mjs`
- Modify: `tests/work-preflight.test.mjs`
- Modify: `tests/work-transport-parity.test.mjs`

**Interfaces:**
- Consumes: normalized groups and stable option IDs.
- Produces: one searchable condition catalog containing branch and ordinary options in authored body order.

- [ ] **Step 1: Add failing integrity tests**

Verify that:

- Group choice IDs appear in condition search with chapter, source node, group label, and option text.
- Duplicate IDs across branch and ordinary options are disabled as ambiguous.
- Conditional and interactive-scene owners fail preflight when they contain interaction groups.
- JSON/PNG transport preserves markers, groups, selected copy, and unknown extension fields.

- [ ] **Step 2: Run integrity tests and verify failure**

Run: `node --test tests/article-condition-model.test.mjs tests/work-preflight.test.mjs tests/work-transport-parity.test.mjs`

Expected: FAIL because the catalog only traverses `node.choices`.

- [ ] **Step 3: Extend catalog and validation**

Traverse branch choices and each valid interaction group. Sort groups by marker order, followed by unplaced groups in stored order. Continue to fail closed for ambiguous or malformed IDs.

- [ ] **Step 4: Run integrity tests and verify pass**

Run: `node --test tests/article-condition-model.test.mjs tests/work-preflight.test.mjs tests/work-transport-parity.test.mjs`

Expected: PASS.

### Task 7: Tutorial and release copy

**Files:**
- Modify: `js/pages/resources.js`
- Modify: `js/release-announcement.js`
- Modify: `tests/resources-page.test.mjs`
- Modify: `tests/release-announcement.test.mjs`

**Interfaces:**
- Consumes: completed author and reader behavior.

- [ ] **Step 1: Add failing copy coverage**

Require tutorial copy for:

- adding multiple ordinary-interaction groups;
- placing and moving groups in body text;
- recovering an unplaced group;
- branch choices remaining at the node end;
- independent group memory and hidden conditions;
- legacy work compatibility.

- [ ] **Step 2: Run copy tests and verify failure**

Run: `node --test tests/resources-page.test.mjs tests/release-announcement.test.mjs`

Expected: FAIL until the new terms and routes exist.

- [ ] **Step 3: Update tutorial in its current information architecture**

Keep the established tutorial format. Do not write meta-instructions about teaching the author. Use “并行选项”, “剧情分支”, “普通互动组”, and “隐藏节点”; do not introduce gendered hierarchy terminology.

- [ ] **Step 4: Run copy tests and verify pass**

Run: `node --test tests/resources-page.test.mjs tests/release-announcement.test.mjs`

Expected: PASS.

### Task 8: Full verification and browser acceptance

**Files:**
- Verify only unless defects are found.

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build:verify`

Expected: TypeScript and both Vite builds succeed.

- [ ] **Step 3: Browser acceptance at port 8765**

Create one article chapter whose first normal node contains:

- prose;
- ordinary group A;
- more prose;
- ordinary group B;
- more prose;
- two tail branch choices.

Verify on desktop and a phone viewport:

- both groups appear at their authored positions;
- each group can be selected and reselected independently;
- multiline selected copy follows reader paragraph formatting;
- neither ordinary group navigates;
- branch selection navigates;
- a hidden node requiring one choice from each group appears only after both are selected;
- reload/import retains IDs, placements, copy, and targets.

- [ ] **Step 4: Inspect final repository state**

Run:

```powershell
git status --short
git diff --check
```

Expected: only intended feature changes plus the pre-existing untracked critique file; no new whitespace errors outside vendored MediaPipe sources.
