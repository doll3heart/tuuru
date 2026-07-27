# Reader Manager Distillation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing reader capabilities feel like natural extensions of book management instead of separate feature panels.

**Architecture:** Preserve all reader-library data and pure state operations. Change only the manager information architecture: keep the active save selector visible, hide save mutations behind one management disclosure, fold identity creation into the existing selector, and consolidate footprints, unlocked memories, and route comparison inside one collapsed reading-record section.

**Tech Stack:** Vanilla DOM, CSS, Node test runner, JSDOM.

## Global Constraints

- No stored reader data or feature capability may be removed.
- The default manager view must expose one primary continuation action and no more than one visible action per secondary concept.
- Empty or inapplicable sections stay absent.
- Keyboard names, focus order, 44px touch targets, and narrow-screen behavior remain accessible.

---

### Task 1: Progressive save and identity controls

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Preserves: all existing slot and identity state operations.
- Produces: one visible `管理存档` action and one identity selector whose `__new__` option opens the blank identity editor.

- [ ] **Step 1: Add failing DOM assertions**

Assert rename/create/delete are absent from the default visible control row, become available after `管理存档`, and identity creation starts from the selector rather than a separate permanent button.

- [ ] **Step 2: Implement progressive controls**

Move slot mutations into a hidden inline panel, keep destructive confirmation inside it, add `＋ 新建身份组` to the identity selector, and keep only `编辑` visible when a saved identity is active.

- [ ] **Step 3: Run focused tests**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 2: Consolidated reading record

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-library-tools-ui.test.mjs`

**Interfaces:**
- Preserves: checkpoint rollback, memoir rows, and slot comparison.
- Produces: one collapsed native `details` region labeled `阅读记录`.

- [ ] **Step 1: Add failing hierarchy assertions**

Assert the top-level manager has no separate `阅读足迹`, `已解锁回忆录`, or `周目路线对比` headings, while their controls and content remain inside `阅读记录`.

- [ ] **Step 2: Merge the record hierarchy**

Use one summary containing route length, choice count, and unlocked fragment count. Render checkpoint rollback, memoir, and comparison as lightweight subsections only after the disclosure opens.

- [ ] **Step 3: Run focused tests**

Run: `node --test tests/reader-library-tools-ui.test.mjs`

Expected: PASS.

### Task 3: Verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`

**Interfaces:**
- Produces: evidence that the distilled manager retains every capability.

- [ ] **Step 1: Run full verification**

Run: `npm run verify`

Expected: all tests and production build verification pass.

- [ ] **Step 2: Run whitespace validation**

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Perform browser comparison**

Verify the default desktop manager is materially shorter, low-frequency controls remain discoverable, record content opens on demand, and the narrow layout stays single-column without horizontal overflow.
