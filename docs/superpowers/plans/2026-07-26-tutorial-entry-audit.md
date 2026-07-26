# Tutorial Entry Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shipped tutorial instruction match a real current control, describe every opening path click by click, and remove vague or padded copy.

**Architecture:** Audit the rendered tutorial against the current author and reader interfaces at `127.0.0.1:8765`, then correct the guide, feature manual, and FAQ in `js/pages/resources.js`. Add copy-contract tests for forbidden internal shorthand, stale controls, contrast templates, and required visible entry labels.

**Tech Stack:** Browser JavaScript, Node test runner, JSDOM, static source assertions.

## Global Constraints

- Every entry path must name the visible page, region, control, and follow-up control in click order.
- Describe different desktop and touch paths separately when the controls differ.
- Do not use internal labels such as “章节操作” or “作品结构”.
- Do not use arrow shorthand as a substitute for a sentence.
- Do not use “不是……而是……”, “并非……而是……” or similar contrast templates.
- Keep sentences short and remove claims that cannot be reproduced in the current build.
- Do not change application behavior or unrelated UI.
- Keep the unrelated `.impeccable/critique` file untouched.

---

### Task 1: Add tutorial copy contracts

**Files:**
- Modify: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: rendered tutorial source from `js/pages/resources.js`.
- Produces: regression checks for direct entry wording and banned stale wording.

- [x] **Step 1: Add failing assertions**

Assert that tutorial copy contains the visible article chapter path:

```text
右侧“节点列表”
目标章节名称
这一行右侧的“…”按钮
展开“＋、隐、◎、✎、×”
```

Reject these patterns in tutorial output:

```text
作品结构
章节操作
上移、下移
不是…而是…
并非…而是…
```

- [x] **Step 2: Run the tutorial test and confirm failure**

Run:

```text
node --test tests/resources-page.test.mjs
```

Expected: failure on current shorthand, stale entry names, and contrast sentences.

### Task 2: Audit first-use, library, file, and backup instructions

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: current homepage, work-card, collection, import, export, and backup controls.
- Produces: short click-by-click instructions for the first-use guide, “作品与书架”, and “文件与备份”.

- [x] **Step 1: Check every named control in the live homepage**

Open the author homepage and verify the exact labels and disclosure behavior for new work, work information, reading, export, backup, collection creation, migration, and restore.

- [x] **Step 2: Replace vague or false paths**

Rewrite each affected `steps`, `faq`, and `features` entry with the visible control sequence. Delete unsupported alternatives.

- [x] **Step 3: Run the tutorial test**

Run:

```text
node --test tests/resources-page.test.mjs
```

Expected: the library and file copy contracts pass.

### Task 3: Audit interactive-article and interactive-picture instructions

**Files:**
- Modify: `js/pages/resources.js`
- Modify: `js/release-announcement.js` only for stale control names found during the same check
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: current article editor, structure panel, node menus, toolbar, condition editor, interactive-picture editor, and preview.
- Produces: exact desktop and touch instructions for chapters, nodes, scenes, interactions, branches, hidden nodes, notes, formatting, phone cards, and interactive pictures.

- [x] **Step 1: Verify every article entry in the live editor**

Open chapter and node menus, toolbars, side tabs, dialogs, and interactive-picture editor. Record the exact visible labels and when controls appear.

- [x] **Step 2: Rewrite article guide, FAQ, and feature manual**

Use full visible paths such as:

```text
找到右侧“节点列表” → 找到目标章节名称 → 点这一行右侧的“…”按钮
```

Write this as sentences rather than arrow shorthand. Explain that the menu reveals `＋、隐、◎、✎、×`, then name the required button.

- [x] **Step 3: Remove stale movement and contrast copy**

Remove every mention of node up/down buttons and every “不是……而是……” sentence from tutorial and related update copy.

- [x] **Step 4: Run focused article and tutorial tests**

Run:

```text
node --test tests/article-hidden-node-editor.test.mjs tests/article-outline-accessibility.test.mjs tests/resources-page.test.mjs
```

Expected: all focused tests pass.

### Task 4: Audit phone, social, and placeholder instructions

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: current phone editor Apps, contact editor, message editor, forum editor, role access, pacing, and placeholder controls.
- Produces: reproducible entries for “小手机”, “人物社交”, “占位符”, and their feature manual sections.

- [x] **Step 1: Verify labels and opening behavior**

Check every named App, menu, long-press/right-click action, editor button, and settings entry against current code and live controls.

- [x] **Step 2: Correct, shorten, or delete each unsupported claim**

Keep one action per sentence. Separate computer and touch instructions where needed.

- [x] **Step 3: Run tutorial tests**

Run:

```text
node --test tests/resources-page.test.mjs tests/resources-page-smoke.test.mjs
```

If `tests/resources-page-smoke.test.mjs` does not exist, run only the existing tutorial and resource-page tests selected by `rg --files tests`.

### Task 5: Final rendered audit and regression verification

**Files:**
- Modify: `docs/superpowers/plans/2026-07-26-tutorial-entry-audit.md`

**Interfaces:**
- Consumes: final tutorial render and all modified source.
- Produces: a verified tutorial with no unsupported paths.

- [x] **Step 1: Scan final source for banned wording**

Run:

```text
rg -n "作品结构|章节操作|上移、下移|不是.*而是|并非.*而是" js/pages/resources.js js/release-announcement.js
```

Expected: no tutorial or related current-announcement matches.

- [x] **Step 2: Inspect every rendered tutorial directory**

Open each tutorial directory button, confirm the expected panel appears, and sample every accordion entry after the text audit.

- [x] **Step 3: Run full verification**

Run:

```text
npm test
npm run build:verify
```

Expected: all tests and production build pass.

- [x] **Step 4: Confirm the local server**

Request `http://127.0.0.1:8765/js/pages/resources.js` and confirm it contains the final direct entry copy.
